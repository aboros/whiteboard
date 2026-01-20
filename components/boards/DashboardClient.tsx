'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Board } from '@/lib/actions/boards'
import { BoardList } from './BoardList'
import { CreateBoardButton } from './CreateBoardButton'

interface DashboardClientProps {
  initialBoards: Board[]
}

export function DashboardClient({ initialBoards }: DashboardClientProps) {
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
              {initialBoards.length}{' '}
              {initialBoards.length === 1 ? 'board' : 'boards'}
            </p>
          </div>
          <CreateBoardButton />
        </div>

        <BoardList
          boards={initialBoards}
          onCreateClick={() => {
            // Handled by CreateBoardButton
          }}
          onDelete={handleRefresh}
        />
      </div>
    </main>
  )
}
