'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'
import { getBoard } from '@/lib/actions/boards'

// Type for Excalidraw API ref
type ExcalidrawAPI = any

// Dynamic import to avoid SSR issues
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full w-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading canvas...</p>
        </div>
      </div>
    ),
  }
)

interface PublicExcalidrawWrapperProps {
  initialElements: any[]
  initialAppState: any
  boardSlug: string
  boardName?: string
}

const MAX_ELEMENTS = 5000
const POLL_INTERVAL_MS = 60000 // 1 minute

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
 * Sanitizes appState to remove non-serializable properties
 */
function sanitizeAppState(appState: any): any {
  if (!appState || typeof appState !== 'object') {
    return {}
  }

  // Remove collaborators Map (not serializable)
  const sanitized = { ...appState }
  if (sanitized.collaborators) {
    delete sanitized.collaborators
  }

  return sanitized
}

/**
 * Merges elements by ID, keeping the latest version of each element
 * Simple last-write-wins strategy for polling updates
 */
function mergeElements(localElements: any[], remoteElements: any[]): any[] {
  const remoteMap = new Map<string, any>()
  remoteElements.forEach((el) => {
    if (el && el.id) {
      remoteMap.set(el.id, el)
    }
  })

  const merged: any[] = []
  const processedIds = new Set<string>()

  // Process local elements first
  localElements.forEach((localEl) => {
    if (!localEl || !localEl.id) {
      return
    }

    const remoteEl = remoteMap.get(localEl.id)
    if (remoteEl) {
      // Element exists in both - prefer remote (newer from database)
      merged.push(remoteEl)
      processedIds.add(localEl.id)
      remoteMap.delete(localEl.id)
    } else {
      // Element only exists locally - keep it (might be deleted remotely)
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

/**
 * Simplified Excalidraw wrapper for public/read-only viewing
 * Polls for updates every minute to reflect live changes
 * No auto-save, no realtime, no collaboration features
 */
export function PublicExcalidrawWrapper({
  initialElements,
  initialAppState,
  boardSlug,
  boardName,
}: PublicExcalidrawWrapperProps) {
  const excalidrawRef = useRef<ExcalidrawAPI | null>(null)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Track current elements to compare with fetched updates
  const currentElementsRef = useRef<any[]>([])

  // Initialize data synchronously before first render
  // This ensures Excalidraw receives initialData on mount
  const initializeData = (() => {
    try {
      // Validate the initial data
      const validation = validateExcalidrawData(initialElements, initialAppState)
      
      if (!validation.valid) {
        return {
          elements: [],
          appState: {},
          error: validation.error || 'Invalid board data',
        }
      }

      // Data is valid, sanitize and use it
      const sanitizedAppState = sanitizeAppState(initialAppState || {})
      const initialElementsArray = initialElements || []
      
      currentElementsRef.current = initialElementsArray
      
      return {
        elements: initialElementsArray,
        appState: sanitizedAppState,
        error: null,
      }
    } catch (error) {
      // JSON parse error or other validation error
      console.error('Failed to load board data:', error)
      return {
        elements: [],
        appState: {},
        error: 'Data corrupted - starting fresh',
      }
    }
  })()

  // Set error state if validation failed
  useEffect(() => {
    if (initializeData.error) {
      setHasError(true)
      setErrorMessage(initializeData.error)
    } else {
      setHasError(false)
      setErrorMessage(null)
    }
  }, [initializeData.error])

  // Initial data for Excalidraw (set synchronously)
  const initialData = {
    elements: initializeData.elements,
    appState: initializeData.appState,
  }

  // Update Excalidraw scene after it mounts (in case initialData wasn't enough)
  useEffect(() => {
    if (hasError || !excalidrawRef.current || !initialData.elements.length) {
      return
    }

    // Small delay to ensure Excalidraw is fully mounted
    const timeout = setTimeout(() => {
      if (excalidrawRef.current) {
        excalidrawRef.current.updateScene({
          elements: initialData.elements,
          appState: initialData.appState,
        })
      }
    }, 100)

    return () => clearTimeout(timeout)
  }, [hasError, initialData.elements, initialData.appState])

  // Poll for updates every minute
  useEffect(() => {
    if (hasError || !excalidrawRef.current) {
      return
    }

    const pollForUpdates = async () => {
      try {
        const result = await getBoard(boardSlug)
        
        if (result.error || !result.data) {
          // Silently fail - don't show error for polling failures
          console.warn('Failed to poll board updates:', result.error)
          return
        }

        const board = result.data
        const dbElements = Array.isArray(board.elements) ? board.elements : []
        const dbAppState = board.app_state && typeof board.app_state === 'object' 
          ? board.app_state 
          : {}

        // Get current elements from Excalidraw
        const currentElements = excalidrawRef.current.getSceneElementsIncludingDeleted() || []
        
        // Merge database elements with current elements
        const mergedElements = mergeElements(currentElements, dbElements)
        
        // Check if elements actually changed
        const elementsChanged = JSON.stringify(mergedElements) !== JSON.stringify(currentElements)
        
        if (elementsChanged) {
          // Update Excalidraw scene with merged elements
          const sanitizedAppState = sanitizeAppState(dbAppState)
          
          excalidrawRef.current.updateScene({
            elements: mergedElements,
            appState: sanitizedAppState,
          })
          
          // Update ref
          currentElementsRef.current = mergedElements
        }
      } catch (error) {
        // Silently fail - don't show error for polling failures
        console.warn('Error polling board updates:', error)
      }
    }

    // Poll immediately after a short delay (to avoid duplicate initial load)
    const initialTimeout = setTimeout(() => {
      pollForUpdates()
    }, 5000) // Wait 5 seconds before first poll

    // Then poll every minute
    const interval = setInterval(pollForUpdates, POLL_INTERVAL_MS)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [boardSlug, hasError])

  // Error state UI
  if (hasError) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Failed to Load Board
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {errorMessage || 'An error occurred while loading the board.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="w-full h-full">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawRef.current = api
          }}
          initialData={initialData}
          viewModeEnabled={true}
        />
      </div>
    </div>
  )
}
