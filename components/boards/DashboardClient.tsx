'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Board } from '@/lib/actions/boards'
import { BoardList } from './BoardList'
import { CreateBoardButton } from './CreateBoardButton'
import { EmptyState } from './EmptyState'

interface DashboardClientProps {
  initialOwnedBoards: Board[]
  initialSharedBoards: Board[]
}

export function DashboardClient({
  initialOwnedBoards,
  initialSharedBoards,
}: DashboardClientProps) {
  const router = useRouter()

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              My Boards
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {initialOwnedBoards.length}{' '}
              {initialOwnedBoards.length === 1 ? 'board' : 'boards'}
            </p>
          </div>
          <CreateBoardButton />
        </div>

        {initialOwnedBoards.length === 0 ? (
          <EmptyState
            onCreateClick={() => {
              // Handled by CreateBoardButton
            }}
          />
        ) : (
          <BoardList
            boards={initialOwnedBoards}
            onCreateClick={() => {
              // Handled by CreateBoardButton
            }}
            onDelete={handleRefresh}
            isOwner={true}
          />
        )}

        {initialSharedBoards.length > 0 && (
          <div className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Shared with me
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {initialSharedBoards.length}{' '}
                {initialSharedBoards.length === 1 ? 'board' : 'boards'} shared
                with you
              </p>
            </div>
            <BoardList
              boards={initialSharedBoards}
              onCreateClick={() => {
                // Handled by CreateBoardButton
              }}
              onDelete={handleRefresh}
              isOwner={false}
            />
          </div>
        )}
      </div>
    </main>
  )
}
