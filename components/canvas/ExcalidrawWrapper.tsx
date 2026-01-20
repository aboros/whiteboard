'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types'

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

export function ExcalidrawWrapper({
  initialElements,
  initialAppState,
  boardSlug,
  boardName,
}: ExcalidrawWrapperProps) {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null)
  const [elements, setElements] = useState<any[]>([])
  const [appState, setAppState] = useState<any>({})
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

      // Data is valid, use it
      setElements(initialElements || [])
      setAppState(initialAppState || {})
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
  }, [initialElements, initialAppState])

  // Initialize on mount
  useEffect(() => {
    initializeData()
  }, [initializeData])

  const handleChange = useCallback((elements: any[], appState: any) => {
    // Update local state immediately for responsiveness
    setElements(elements)
    setAppState(appState)
    
    // Note: Auto-save will be implemented in Task #7
    // For now, we just update the local state
  }, [])

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
    <div className="w-screen h-screen fixed top-0 left-0 right-0 bottom-0">
      <Excalidraw
        ref={excalidrawRef}
        initialData={{
          elements: elements,
          appState: appState,
        }}
        onChange={handleChange}
      />
    </div>
  )
}
