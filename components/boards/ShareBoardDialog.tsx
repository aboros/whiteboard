'use client'

import { useState, FormEvent, useEffect } from 'react'
import { shareBoard, revokeBoardAccess, getSharedUsers, SharedUser, getBoard, setBoardPublicStatus, Board } from '@/lib/actions/boards'
import { X, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ShareBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  boardSlug: string
}

function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim()
  if (!trimmed || trimmed.length === 0) {
    return { valid: false, error: 'Email is required' }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' }
  }
  return { valid: true }
}

export function ShareBoardDialog({
  open,
  onOpenChange,
  boardId,
  boardSlug,
}: ShareBoardDialogProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isRevoking, setIsRevoking] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [isLoadingPublic, setIsLoadingPublic] = useState(false)
  const [isTogglingPublic, setIsTogglingPublic] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  // Generate public URL
  const publicUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/board/${boardSlug}`
    : ''

  // Load board data and shared users when dialog opens
  useEffect(() => {
    if (open && boardId) {
      loadBoardData()
      loadSharedUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boardId])

  const loadBoardData = async () => {
    // Fetch board's public status directly using Supabase client
    setIsLoadingPublic(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('boards')
      .select('is_public')
      .eq('id', boardId)
      .single()
    
    if (!error && data) {
      setIsPublic(data.is_public || false)
    }
    setIsLoadingPublic(false)
  }

  const loadSharedUsers = async () => {
    setIsLoadingUsers(true)
    const result = await getSharedUsers(boardId)
    if (result.error) {
      setError(result.error)
    } else {
      setSharedUsers(result.data || [])
    }
    setIsLoadingUsers(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setWarning(null)

    // Client-side validation
    const validation = validateEmail(email)
    if (!validation.valid) {
      setError(validation.error || 'Invalid email')
      return
    }

    setIsSubmitting(true)

    const result = await shareBoard(boardId, email)

    if (!result.success) {
      setError(result.error || 'Failed to share board')
      if (result.warning) {
        setWarning(result.warning)
      }
      setIsSubmitting(false)
      return
    }

    // Success
    setEmail('')
    setError(null)
    setWarning(null)
    setIsSubmitting(false)
    // Reload shared users
    await loadSharedUsers()
    router.refresh()
  }

  const handleRevoke = async (userId: string) => {
    setIsRevoking(userId)
    setError(null)
    setWarning(null)

    const result = await revokeBoardAccess(boardId, userId)

    if (result.error) {
      setError(result.error)
      setIsRevoking(null)
      return
    }

    // Success - reload shared users
    await loadSharedUsers()
    setIsRevoking(null)
    router.refresh()
  }

  const handleTogglePublic = async (newPublicStatus: boolean) => {
    setIsTogglingPublic(true)
    setError(null)
    setWarning(null)

    const result = await setBoardPublicStatus(boardId, newPublicStatus)

    if (result.error) {
      setError(result.error)
      setIsTogglingPublic(false)
      return
    }

    // Success - update local state
    setIsPublic(newPublicStatus)
    setIsTogglingPublic(false)
    router.refresh()
  }

  const handleCopyUrl = async () => {
    if (publicUrl) {
      try {
        await navigator.clipboard.writeText(publicUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy URL:', err)
        setError('Failed to copy URL. Please copy it manually.')
      }
    }
  }

  const handleClose = () => {
    if (!isSubmitting && !isRevoking) {
      setEmail('')
      setError(null)
      setWarning(null)
      setCopied(false)
      onOpenChange(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Share Board
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting || isRevoking !== null}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="mb-4">
            <label
              htmlFor="share-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Share with (email)
            </label>
            <div className="flex gap-2">
              <input
                id="share-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                  setWarning(null)
                }}
                placeholder="user@example.com"
                disabled={isSubmitting}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                autoFocus
              />
              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {warning && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
              {warning}
            </div>
          )}
        </form>

        {/* Public Access Toggle */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <label
                htmlFor="public-toggle"
                className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
              >
                Public Access
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Make this board viewable by anyone with the link (read-only)
              </p>
            </div>
            {isLoadingPublic ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading...
              </div>
            ) : (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => handleTogglePublic(e.target.checked)}
                  disabled={isTogglingPublic}
                  className="sr-only peer"
                  id="public-toggle"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
              </label>
            )}
          </div>

          {/* Public URL Display */}
          {isPublic && publicUrl && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Public Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={publicUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  aria-label="Copy public URL"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Anyone with this link can view the board (read-only)
              </p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Shared with ({sharedUsers.length})
          </h3>

          {isLoadingUsers ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : sharedUsers.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No one has access to this board yet.
            </div>
          ) : (
            <div className="space-y-2">
              {sharedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Shared {new Date(user.shared_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevoke(user.id)}
                    disabled={isRevoking === user.id}
                    className="px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRevoking === user.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting || isRevoking !== null}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
