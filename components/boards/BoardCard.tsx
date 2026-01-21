'use client'

import Link from 'next/link'
import { Trash2, Calendar, Share2, Users, Globe } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Board, getBoardShareCount } from '@/lib/actions/boards'
import { DeleteBoardDialog } from './DeleteBoardDialog'
import { ShareBoardDialog } from './ShareBoardDialog'
import { createClient } from '@/lib/supabase/client'

interface BoardCardProps {
  board: Board
  onDelete?: () => void
  isOwner?: boolean
}

export function BoardCard({ board, onDelete, isOwner }: BoardCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareCount, setShareCount] = useState<number | null>(null)
  const [isOwnerState, setIsOwnerState] = useState(isOwner ?? false)

  // Check if current user is owner
  useEffect(() => {
    if (isOwner !== undefined) {
      setIsOwnerState(isOwner)
    } else {
      // Check ownership by comparing with current user
      const checkOwnership = async () => {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setIsOwnerState(user?.id === board.created_by)
      }
      checkOwnership()
    }
  }, [board.created_by, isOwner])

  // Load share count if user is owner
  useEffect(() => {
    if (isOwnerState) {
      loadShareCount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnerState, board.id])

  const loadShareCount = async () => {
    const result = await getBoardShareCount(board.id)
    if (!result.error && result.data !== undefined) {
      setShareCount(result.data)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteDialog(true)
  }

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowShareDialog(true)
  }

  const handleDeleteSuccess = () => {
    setShowDeleteDialog(false)
    onDelete?.()
  }

  const handleShareSuccess = () => {
    loadShareCount()
  }

  return (
    <>
      <div className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200">
        <Link
          href={`/board/${board.slug}`}
          className="block p-6 h-full"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 flex items-start gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1">
                {board.name}
              </h3>
              {board.is_public && (
                <div className="flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                  <Globe className="w-3 h-3" />
                  <span>Public</span>
                </div>
              )}
            </div>
            <div className="ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isOwnerState && (
                <button
                  onClick={handleShareClick}
                  className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  aria-label={`Share board ${board.name}`}
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              {isOwnerState && (
                <button
                  onClick={handleDeleteClick}
                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                  aria-label={`Delete board ${board.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Calendar className="w-4 h-4 mr-1.5" />
                <span>Updated {formatDate(board.updated_at)}</span>
              </div>
              {board.is_public && (
                <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                  <Globe className="w-3 h-3 mr-1" />
                  <span>Public</span>
                </div>
              )}
            </div>
            {isOwnerState && shareCount !== null && shareCount > 0 && (
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Users className="w-4 h-4 mr-1" />
                <span>{shareCount} {shareCount === 1 ? 'person' : 'people'}</span>
              </div>
            )}
          </div>
        </Link>
      </div>

      <DeleteBoardDialog
        board={board}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onSuccess={handleDeleteSuccess}
      />
      {isOwnerState && (
        <ShareBoardDialog
          boardId={board.id}
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
        />
      )}
    </>
  )
}
