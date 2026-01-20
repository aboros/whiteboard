'use client'

import Link from 'next/link'
import { Trash2, Calendar } from 'lucide-react'
import { useState } from 'react'
import { Board } from '@/lib/actions/boards'
import { DeleteBoardDialog } from './DeleteBoardDialog'

interface BoardCardProps {
  board: Board
  onDelete?: () => void
}

export function BoardCard({ board, onDelete }: BoardCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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

  const handleDeleteSuccess = () => {
    setShowDeleteDialog(false)
    onDelete?.()
  }

  return (
    <>
      <div className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200">
        <Link
          href={`/board/${board.slug}`}
          className="block p-6 h-full"
        >
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1">
              {board.name}
            </h3>
            <button
              onClick={handleDeleteClick}
              className="ml-2 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label={`Delete board ${board.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="w-4 h-4 mr-1.5" />
            <span>Updated {formatDate(board.updated_at)}</span>
          </div>
        </Link>
      </div>

      <DeleteBoardDialog
        board={board}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onSuccess={handleDeleteSuccess}
      />
    </>
  )
}
