'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useDebouncedCallback } from 'use-debounce'
import '@excalidraw/excalidraw/index.css'
import { updateBoard, getBoard } from '@/lib/actions/boards'
import { ToastManager, type ToastType } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { PresenceAvatars } from '@/components/canvas/PresenceAvatars'

// Type for Excalidraw API ref - using any since Excalidraw types aren't always exported correctly
// The actual API uses readonly arrays, so we use any to avoid type conflicts
type ExcalidrawAPI = any

// Dynamic import to avoid SSR issues
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading canvas...</p>
        </div>
      </div>
    ),
  }
)

interface ExcalidrawWrapperProps {
  initialElements: any[]
  initialAppState: any
  boardSlug: string
  boardName?: string
}

const MAX_ELEMENTS = 5000
const SAVE_DEBOUNCE_MS = 5000
const MAX_RETRIES = 3

/**
 * Validates Excalidraw data structure
 */
function validateExcalidrawData(elements: any[], appState: any): {
  valid: boolean
  error?: string
} {
  if (!Array.isArray(elements)) {
    return { valid: false, error: 'Elements must be an array' }
  }

  if (elements.length > MAX_ELEMENTS) {
    return {
      valid: false,
      error: `Board contains too many elements (${elements.length}). Maximum allowed: ${MAX_ELEMENTS}`,
    }
  }

  if (appState !== null && typeof appState !== 'object') {
    return { valid: false, error: 'App state must be an object or null' }
  }

  return { valid: true }
}

/**
 * Filters appState to only include properties that should be shared across clients.
 * Excludes all viewport/UI state (zoom, pan, scroll, tool selection, color picker, etc.).
 * Only includes canvas-level properties that are part of the drawing itself.
 * 
 * Note: For now, we exclude ALL appState from broadcasts since viewport state
 * (zoom, pan, scroll) should be independent per collaborator, and most other
 * appState is UI-only. Only elements are broadcasted.
 */
function filterSharedAppState(appState: any): any {
  // Don't broadcast any appState - each collaborator should have independent:
  // - Viewport (zoom, pan, scroll)
  // - Tool selection
  // - Color picker
  // - UI state
  // 
  // If we need to share canvas-level properties in the future (like viewBackgroundColor
  // or gridSize), we can add them here, but for now we keep it minimal.
  return {}
}

/**
 * Conflict resolution: Last-write-wins per element ID (Subtask 8.3)
 * Merges remote elements with local elements, keeping the latest version of each element by ID
 * Based on excalidraw-room pattern: prefer higher version numbers (newer elements)
 */
function mergeElementsByLastWrite(
  localElements: any[],
  remoteElements: any[]
): any[] {
  const getVersion = (el: any): number => {
    // Excalidraw elements have a version property that increments with each update
    const v = el?.version
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v
    }
    // If no version, check for updated timestamp or default to 0
    if (el?.updated) {
      return el.updated
    }
    return 0
  }

  // Create a map of remote elements by ID
  const remoteMap = new Map<string, any>()
  remoteElements.forEach((el) => {
    if (el && el.id) {
      remoteMap.set(el.id, el)
    }
  })

  // Update or add remote elements to local
  const merged: any[] = []
  const processedIds = new Set<string>()

  // First, process local elements
  localElements.forEach((localEl) => {
    if (!localEl || !localEl.id) {
      return
    }

    const remoteEl = remoteMap.get(localEl.id)
    if (remoteEl) {
      // Element exists in both - prefer the one with higher version
      // This handles out-of-order network updates correctly
      const localVersion = getVersion(localEl)
      const remoteVersion = getVersion(remoteEl)
      
      // Only use remote if it's actually newer (strictly greater)
      // If versions are equal, prefer local to avoid unnecessary updates
      if (remoteVersion > localVersion) {
        merged.push(remoteEl)
      } else {
        merged.push(localEl)
      }
      processedIds.add(localEl.id)
      remoteMap.delete(localEl.id)
    } else {
      // Element only exists locally - keep it
      merged.push(localEl)
      processedIds.add(localEl.id)
    }
  })

  // Add new remote-only elements
  remoteMap.forEach((remoteEl) => {
    if (!processedIds.has(remoteEl.id)) {
      merged.push(remoteEl)
    }
  })

  return merged
}

interface RetryQueueItem {
  elements: any[]
  appState: any
  attempts: number
  timestamp: number
}

export function ExcalidrawWrapper({
  initialElements,
  initialAppState,
  boardSlug,
  boardName,
}: ExcalidrawWrapperProps) {
  const excalidrawRef = useRef<ExcalidrawAPI | null>(null)
  const [elements, setElements] = useState<any[]>([])
  const [appState, setAppState] = useState<any>({})
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Auto-save state
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([])
  const retryQueueRef = useRef<RetryQueueItem[]>([])
  const RETRY_QUEUE_KEY = useMemo(() => `retry-queue-${boardSlug}`, [boardSlug])
  const lastSavedElementsRef = useRef<any[]>([])
  
  // Track initial data for Excalidraw (should only be set once on mount)
  const initialDataRef = useRef<{ elements: any[]; appState: any } | null>(null)
  
  // Flag to prevent onChange loops when we're updating from our own state changes
  const isUpdatingFromStateRef = useRef(false)
  
  // Flag to prevent broadcasting our own updates (when we receive a remote update)
  const isApplyingRemoteUpdateRef = useRef(false)
  
  // Use refs to track current values without causing re-renders
  const currentElementsRef = useRef<any[]>([])
  const currentAppStateRef = useRef<any>({})
  
  // Realtime channel ref
  const channelRef = useRef<RealtimeChannel | null>(null)
  const previousStatusRef = useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  
  // Presence tracking state
  const [onlineUsers, setOnlineUsers] = useState<Array<{ user_id: string; email: string; online_at: string }>>([])
  
  // Track last broadcast time to debounce rapid updates during drawing
  const lastBroadcastRef = useRef<number>(0)
  const broadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const BROADCAST_DEBOUNCE_MS = 50 // Debounce broadcasts by 50ms during drawing

  // Sanitize appState to ensure Excalidraw compatibility
  const sanitizeAppState = useCallback((appState: any): any => {
    if (!appState || typeof appState !== 'object') {
      return {}
    }

    // Create a clean copy of appState
    const sanitized = { ...appState }

    // Excalidraw expects collaborators to be a Map, not a plain object
    // Since we're not using real-time collaboration yet (Task 8), we can safely remove it
    // or convert it to a Map if it exists
    if (sanitized.collaborators) {
      if (sanitized.collaborators instanceof Map) {
        // Already a Map, keep it
      } else if (typeof sanitized.collaborators.forEach === 'function') {
        // Already has forEach (might be a Map-like object), keep it
      } else {
        // Convert object to Map or remove it
        // For now, we'll remove it since we're not using collaboration yet
        delete sanitized.collaborators
      }
    }

    return sanitized
  }, [])

  // Validate and initialize data
  const initializeData = useCallback(() => {
    try {
      // Validate the initial data
      const validation = validateExcalidrawData(initialElements, initialAppState)
      
      if (!validation.valid) {
        setHasError(true)
        setErrorMessage(validation.error || 'Invalid board data')
        // Start with empty canvas
        setElements([])
        setAppState({})
        return
      }

      // Data is valid, sanitize and use it
      const sanitizedAppState = sanitizeAppState(initialAppState || {})
      const initialElementsArray = initialElements || []
      setElements(initialElementsArray)
      setAppState(sanitizedAppState)
      // Initialize last saved elements reference
      lastSavedElementsRef.current = JSON.parse(JSON.stringify(initialElementsArray))
      // Store initial data for Excalidraw (only set once)
      if (!initialDataRef.current) {
        initialDataRef.current = {
          elements: initialElementsArray,
          appState: sanitizedAppState,
        }
      }
      setHasError(false)
      setErrorMessage(null)
    } catch (error) {
      // JSON parse error or other validation error
      console.error('Failed to load board data:', error)
      setHasError(true)
      setErrorMessage('Data corrupted - starting fresh')
      setElements([])
      setAppState({})
    }
  }, [initialElements, initialAppState, sanitizeAppState])

  // Initialize on mount
  useEffect(() => {
    initializeData()
    
    // Load retry queue from localStorage
    try {
      const savedQueue = localStorage.getItem(RETRY_QUEUE_KEY)
      if (savedQueue) {
        const queue = JSON.parse(savedQueue) as RetryQueueItem[]
        retryQueueRef.current = queue
      }
    } catch (error) {
      console.error('Failed to load retry queue:', error)
    }
    
    // Set initial online status
    setIsOnline(navigator.onLine)
  }, [initializeData, RETRY_QUEUE_KEY])

  // Save retry queue to localStorage
  const saveRetryQueue = useCallback(() => {
    try {
      localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(retryQueueRef.current))
    } catch (error) {
      console.error('Failed to save retry queue:', error)
    }
  }, [RETRY_QUEUE_KEY])

  // Add toast notification
  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  // Remove toast notification
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  // Deep compare elements to detect actual content changes
  const elementsChanged = useCallback((newElements: any[], oldElements: any[]): boolean => {
    // Quick length check
    if (newElements.length !== oldElements.length) {
      return true
    }

    // Deep comparison by serializing (for Excalidraw elements, this is reliable)
    // We compare the essential properties that indicate content changes
    try {
      const newSerialized = JSON.stringify(
        newElements.map((el) => ({
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          points: el.points,
          text: el.text,
          // Include other essential properties
          strokeColor: el.strokeColor,
          backgroundColor: el.backgroundColor,
          fillStyle: el.fillStyle,
          strokeWidth: el.strokeWidth,
        }))
      )
      const oldSerialized = JSON.stringify(
        oldElements.map((el) => ({
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          points: el.points,
          text: el.text,
          strokeColor: el.strokeColor,
          backgroundColor: el.backgroundColor,
          fillStyle: el.fillStyle,
          strokeWidth: el.strokeWidth,
        }))
      )
      return newSerialized !== oldSerialized
    } catch (error) {
      // If comparison fails, assume changed to be safe
      console.warn('Elements comparison failed, assuming changed:', error)
      return true
    }
  }, [])

  // Save to database with retry logic
  const saveToDb = useCallback(async (elements: any[], appState: any, attempt = 0): Promise<void> => {
    // Don't save if offline (will queue for later)
    if (!navigator.onLine) {
      retryQueueRef.current.push({
        elements,
        appState,
        attempts: 0,
        timestamp: Date.now(),
      })
      saveRetryQueue()
      setIsDirty(true)
      addToast('Offline - changes will sync when back online', 'info')
      return
    }

    setIsSaving(true)

    try {
      const result = await updateBoard(boardSlug, {
        elements,
        app_state: appState,
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Success
      setIsDirty(false)
      setIsSaving(false)
      
      // Update last saved elements reference
      lastSavedElementsRef.current = JSON.parse(JSON.stringify(elements))
      
      // Note: We don't filter the retry queue here because array/object comparison
      // by reference won't work. The queue will be processed normally, and newer
      // successful saves will naturally overwrite older data in the database.
      saveRetryQueue()
    } catch (error) {
      setIsSaving(false)
      console.error('Save failed:', error)

      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const backoffDelay = 1000 * Math.pow(2, attempt) // 1s, 2s, 4s
        retryQueueRef.current.push({
          elements,
          appState,
          attempts: attempt + 1,
          timestamp: Date.now(),
        })
        saveRetryQueue()

        setTimeout(() => {
          saveToDb(elements, appState, attempt + 1)
        }, backoffDelay)
      } else {
        // Max retries exceeded
        retryQueueRef.current.push({
          elements,
          appState,
          attempts: attempt,
          timestamp: Date.now(),
        })
        saveRetryQueue()
        setIsDirty(true)
        addToast('Failed to save. Please try again later.', 'error')
      }
    }
  }, [boardSlug, saveRetryQueue, addToast])

  // Debounced save function
  const debouncedSave = useDebouncedCallback(
    (elements: any[], appState: any) => {
      saveToDb(elements, appState, 0)
    },
    SAVE_DEBOUNCE_MS
  )

  // Process retry queue
  const processRetryQueue = useCallback(async () => {
    if (!navigator.onLine || retryQueueRef.current.length === 0) {
      return
    }

    const queue = [...retryQueueRef.current]
    retryQueueRef.current = []
    saveRetryQueue()

    for (const item of queue) {
      await saveToDb(item.elements, item.appState, item.attempts)
    }
  }, [saveToDb, saveRetryQueue])

  // Process retry queue on mount if there are pending items
  useEffect(() => {
    if (retryQueueRef.current.length > 0 && navigator.onLine) {
      processRetryQueue()
    }
  }, [processRetryQueue])

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Process queued saves when back online
      if (retryQueueRef.current.length > 0) {
        processRetryQueue()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processRetryQueue])

  // Sync from database on reconnect (Subtask 8.4)
  const syncFromDatabase = useCallback(async () => {
    if (!excalidrawRef.current) {
      return
    }

    try {
      const result = await getBoard(boardSlug)
      if (result.error || !result.data) {
        console.error('Failed to fetch board on reconnect:', result.error)
        return
      }

      const board = result.data
      const dbElements = Array.isArray(board.elements) ? board.elements : []
      const dbAppState =
        board.app_state && typeof board.app_state === 'object'
          ? board.app_state
          : {}

      // Get current local elements
      const currentLocalElements =
        excalidrawRef.current.getSceneElementsIncludingDeleted() || []

      // Merge database state with local state (last-write-wins)
      const mergedElements = mergeElementsByLastWrite(
        currentLocalElements,
        dbElements
      )

      // Merge appState: preserve local collaborators Map (it's UI state, not drawing state)
      const localAppState = currentAppStateRef.current || {}
      const mergedAppState = {
        ...dbAppState,
        // Preserve local collaborators - it's UI state that shouldn't be overwritten by DB sync
        collaborators: localAppState.collaborators || undefined,
      }
      
      // If collaborators is undefined, remove the property entirely
      if (mergedAppState.collaborators === undefined) {
        delete mergedAppState.collaborators
      }

      // Apply merged state to Excalidraw
      isApplyingRemoteUpdateRef.current = true
      excalidrawRef.current.updateScene({
        elements: mergedElements,
        appState: mergedAppState,
      })

      // Update refs
      currentElementsRef.current = mergedElements
      currentAppStateRef.current = mergedAppState

      // Update lastSavedElementsRef since these elements came from the database
      // (they're already saved). This prevents marking as dirty unnecessarily.
      lastSavedElementsRef.current = JSON.parse(JSON.stringify(mergedElements))
      // Don't mark as dirty since these are already saved in the database
      setIsDirty(false)

      setTimeout(() => {
        isApplyingRemoteUpdateRef.current = false
      }, 100)

      console.log('Synced from database on reconnect')
    } catch (error) {
      console.error('Error syncing from database:', error)
    }
  }, [boardSlug])

  // Realtime channel setup and broadcast listeners (Subtask 8.1)
  // Set up channel after Excalidraw is mounted
  useEffect(() => {
    if (!supabase) {
      return
    }

    // Wait for Excalidraw API to be available (it's set via excalidrawAPI prop callback)
    // We'll set up the channel, but handlers will check for excalidrawRef.current

    // Create channel for this board
    // Note: self: false means we don't receive our own broadcasts, preventing
    // older updates from overwriting newer local state (excalidraw-room pattern)
    const channel = supabase.channel(`board:${boardSlug}`, {
      config: {
        broadcast: { self: false }, // Don't receive our own broadcasts
      },
    })

    // Listen for presence sync events (Task 9.1)
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      // Deduplicate by user_id (multiple tabs = single presence)
      const allUsers = Object.values(state).flat() as Array<{ user_id: string; email: string; online_at: string }>
      const uniqueUsers = allUsers.reduce((acc, user) => {
        // Only keep first occurrence per user_id
        if (!acc.find(u => u.user_id === user.user_id)) {
          acc.push(user)
        }
        return acc
      }, [] as Array<{ user_id: string; email: string; online_at: string }>)
      setOnlineUsers(uniqueUsers)
    })

    // Listen for broadcast events (scene updates from other users)
    channel.on(
      'broadcast',
      { event: 'scene-update' },
      ({ payload }: { payload: { elements: any[]; appState: any } }) => {
        // Prevent applying our own updates (we'll handle this via isApplyingRemoteUpdateRef)
        if (isApplyingRemoteUpdateRef.current) {
          return
        }

        // Apply remote update to Excalidraw with conflict resolution (Subtask 8.3)
        if (excalidrawRef.current && payload) {
          try {
            // Set flag to prevent onChange from broadcasting this update
            isApplyingRemoteUpdateRef.current = true

            // Get current local elements from Excalidraw
            const currentLocalElements =
              excalidrawRef.current.getSceneElementsIncludingDeleted() || []

            // Merge remote elements with local using last-write-wins per element ID
            const mergedElements = mergeElementsByLastWrite(
              currentLocalElements,
              payload.elements || []
            )

            // Merge appState: preserve local UI state (tool selection, color picker, etc.)
            // and local collaborators Map. Only apply shared appState from remote.
            // Excalidraw expects collaborators to be a Map or undefined
            const localAppState = currentAppStateRef.current || {}
            const remoteAppState = payload.appState || {}
            
            // Merge: remote shared appState + local UI state + local collaborators
            // This ensures tool selection, color picker, etc. remain local-only
            const mergedAppState = {
              ...localAppState,  // Start with local state (preserves UI preferences)
              ...remoteAppState,  // Overlay shared state from remote (zoom, viewport, etc.)
              // Preserve local collaborators - it's UI state that shouldn't be overwritten by remote updates
              collaborators: localAppState.collaborators || undefined,
            }
            
            // If collaborators is undefined, remove the property entirely
            if (mergedAppState.collaborators === undefined) {
              delete mergedAppState.collaborators
            }

            // Update scene with merged elements and appState
            excalidrawRef.current.updateScene({
              elements: mergedElements,
              appState: mergedAppState,
            })

            // Update our refs to track the new merged state
            currentElementsRef.current = mergedElements
            currentAppStateRef.current = mergedAppState

            // IMPORTANT: Update lastSavedElementsRef to reflect that these elements
            // are already saved (they came from another client who has saved them).
            // This prevents marking the state as dirty when onChange fires after
            // applying the remote update.
            // Only update if the merged elements differ from what we currently have saved
            // to avoid unnecessary updates
            const currentSaved = lastSavedElementsRef.current
            if (elementsChanged(mergedElements, currentSaved)) {
              lastSavedElementsRef.current = JSON.parse(JSON.stringify(mergedElements))
              // Don't mark as dirty since these are already saved by another client
              setIsDirty(false)
            }

            // Reset flag after a short delay to allow Excalidraw to process
            setTimeout(() => {
              isApplyingRemoteUpdateRef.current = false
            }, 100)
          } catch (error) {
            console.error('Failed to apply remote update:', error)
            isApplyingRemoteUpdateRef.current = false
          }
        }
      }
    )

    // Subscribe to the channel
    channel.subscribe((status) => {
      // Detect reconnection: if we were CLOSED/TIMED_OUT and now SUBSCRIBED
      if (
        previousStatusRef.current &&
        (previousStatusRef.current === 'CLOSED' ||
          previousStatusRef.current === 'TIMED_OUT') &&
        status === 'SUBSCRIBED'
      ) {
        console.log('Reconnected - syncing from database')
        // Sync from database on reconnect
        syncFromDatabase()
      }

      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to board:${boardSlug}`)
        
        // Track user presence on subscribe (Task 9.1)
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user && channel) {
            channel.track({
              user_id: user.id,
              email: user.email || 'Unknown',
              online_at: new Date().toISOString(),
            }).catch((error) => {
              console.error('Failed to track presence:', error)
            })
          }
        })
        
        // On initial subscription, also sync from database to ensure we have latest state
        if (!previousStatusRef.current) {
          syncFromDatabase()
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Channel error:', status)
        addToast('Connection error. Reconnecting...', 'error')
      } else if (status === 'TIMED_OUT') {
        console.warn('Channel timed out')
        addToast('Connection timed out. Reconnecting...', 'info')
      } else if (status === 'CLOSED') {
        console.log('Channel closed')
      }

      previousStatusRef.current = status
    })

    channelRef.current = channel

    // Cleanup on unmount
    return () => {
      // Clear any pending broadcast
      if (broadcastTimeoutRef.current) {
        clearTimeout(broadcastTimeoutRef.current)
        broadcastTimeoutRef.current = null
      }
      
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [boardSlug, supabase, addToast, syncFromDatabase])

  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files?: any) => {
      // Prevent infinite loops - if we're updating from our own state change, ignore
      if (isUpdatingFromStateRef.current) {
        return
      }

      // Don't broadcast if we're applying a remote update
      if (isApplyingRemoteUpdateRef.current) {
        return
      }

      // Convert readonly array to mutable for our state management
      const mutableElements = [...elements]
      
      // Update refs (no re-render) - track current values without causing updates
      currentElementsRef.current = mutableElements
      currentAppStateRef.current = appState
      
      // Check if elements actually changed (not just appState like focus/zoom/pan)
      const hasElementChanges = elementsChanged(mutableElements, lastSavedElementsRef.current)

      // DO NOT update state here - this causes re-renders that trigger onChange again
      // We only need to track values in refs for saving purposes
      // State (elements, appState) is only used for initialization, not for tracking changes

      // Only mark as dirty and save if elements actually changed
      // This prevents false "unsaved changes" from focus/blur events
      if (hasElementChanges) {
        // Sanitize appState before saving (remove collaborators Map which can't be serialized)
        const sanitizedAppState = { ...appState }
        // Remove collaborators from saved state (it's a Map and not serializable)
        if (sanitizedAppState.collaborators) {
          delete sanitizedAppState.collaborators
        }

        // Broadcast scene update to other users (Subtask 8.2)
        // Only broadcast elements and shared appState (not UI-only state like tool selection)
        // Debounce broadcasts to avoid spamming during active drawing
        // This matches excalidraw-room pattern of batching updates
        if (channelRef.current) {
          const now = Date.now()
          const timeSinceLastBroadcast = now - lastBroadcastRef.current
          
          // Clear any pending broadcast
          if (broadcastTimeoutRef.current) {
            clearTimeout(broadcastTimeoutRef.current)
            broadcastTimeoutRef.current = null
          }
          
          // If we've broadcast recently, debounce it
          if (timeSinceLastBroadcast < BROADCAST_DEBOUNCE_MS) {
            // Schedule a debounced broadcast
            broadcastTimeoutRef.current = setTimeout(() => {
              if (channelRef.current) {
                try {
                  // Filter appState to only include shared properties (exclude UI-only state)
                  const sharedAppState = filterSharedAppState(currentAppStateRef.current)
                  
                  channelRef.current.send({
                    type: 'broadcast',
                    event: 'scene-update',
                    payload: {
                      elements: currentElementsRef.current,
                      appState: sharedAppState,
                    },
                  })
                  lastBroadcastRef.current = Date.now()
                } catch (error) {
                  console.error('Failed to broadcast scene update:', error)
                }
              }
              broadcastTimeoutRef.current = null
            }, BROADCAST_DEBOUNCE_MS - timeSinceLastBroadcast)
          } else {
            // Broadcast immediately
            try {
              // Filter appState to only include shared properties (exclude UI-only state)
              const sharedAppState = filterSharedAppState(sanitizedAppState)
              
              channelRef.current.send({
                type: 'broadcast',
                event: 'scene-update',
                payload: {
                  elements: mutableElements,
                  appState: sharedAppState,
                },
              })
              lastBroadcastRef.current = now
            } catch (error) {
              console.error('Failed to broadcast scene update:', error)
            }
          }
        }

        // Mark as dirty (this is safe - it only updates save status UI)
        setIsDirty(true)

        // Trigger debounced save with sanitized appState
        debouncedSave(mutableElements, sanitizedAppState)
      }
      // If only appState changed (focus, zoom, pan, etc.), don't mark dirty or save
    },
    [debouncedSave, elementsChanged]
  )

  const handleErrorFallback = useCallback(() => {
    // Reset to empty canvas
    setHasError(false)
    setErrorMessage(null)
    setElements([])
    setAppState({})
    
    // Clear the canvas if API is available
    if (excalidrawRef.current) {
      excalidrawRef.current.updateScene({ elements: [], appState: {} })
    }
  }, [])

  // If there's a validation error, show fallback UI
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            Board Data Error
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {errorMessage || 'The board data could not be loaded.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleErrorFallback}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Start Fresh
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="w-screen h-screen fixed top-0 left-0 right-0 bottom-0 overflow-hidden z-10">
        {/* Save status indicator */}
        <div className="fixed top-4 left-4 z-50 flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg">
          {isSaving ? (
            <>
              <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Saving...</span>
            </>
          ) : isDirty ? (
            <>
              <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Unsaved changes</span>
            </>
          ) : (
            <>
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Saved</span>
            </>
          )}
          {!isOnline && (
            <span className="text-xs text-orange-600 dark:text-orange-400 ml-2">
              (Offline)
            </span>
          )}
        </div>

        {/* Presence indicators (Task 9) */}
        <PresenceAvatars onlineUsers={onlineUsers} />

        <div className="w-full h-full">
          <Excalidraw
            excalidrawAPI={(api) => {
              excalidrawRef.current = api
            }}
            initialData={initialDataRef.current || { elements: [], appState: {} }}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Toast notifications */}
      <ToastManager toasts={toasts} onRemove={removeToast} />
    </>
  )
}
