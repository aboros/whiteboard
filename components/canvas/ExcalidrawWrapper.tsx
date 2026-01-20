'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useDebouncedCallback } from 'use-debounce'
import '@excalidraw/excalidraw/index.css'
import { updateBoard } from '@/lib/actions/boards'
import { ToastManager, type ToastType } from '@/components/ui/Toast'

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
  
  // Use refs to track current values without causing re-renders
  const currentElementsRef = useRef<any[]>([])
  const currentAppStateRef = useRef<any>({})

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

  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files?: any) => {
      // Prevent infinite loops - if we're updating from our own state change, ignore
      if (isUpdatingFromStateRef.current) {
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
        // We'll handle real-time collaboration separately in Task 8
        if (sanitizedAppState.collaborators) {
          delete sanitizedAppState.collaborators
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
      <div className="w-screen h-screen fixed top-0 left-0 right-0 bottom-0">
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

        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawRef.current = api
          }}
          initialData={initialDataRef.current || { elements: [], appState: {} }}
          onChange={handleChange}
        />
      </div>

      {/* Toast notifications */}
      <ToastManager toasts={toasts} onRemove={removeToast} />
    </>
  )
}
