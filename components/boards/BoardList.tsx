'use client'

import { Board } from '@/lib/actions/boards'
import { BoardCard } from './BoardCard'
import { EmptyState } from './EmptyState'
import { useState } from 'react'

interface BoardListProps {
  boards: Board[]
  onCreateClick: () => void
  onDelete?: () => void
  isOwner?: boolean
}

export function BoardList({
  boards,
  onCreateClick,
  onDelete,
  isOwner = true,
}: BoardListProps) {
  if (boards.length === 0) {
    return <EmptyState onCreateClick={onCreateClick} />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {boards.map((board) => (
        <BoardCard
          key={board.id}
          board={board}
          onDelete={onDelete}
          isOwner={isOwner}
        />
      ))}
    </div>
  )
}
