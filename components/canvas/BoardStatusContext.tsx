'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface OnlineUser {
  user_id: string
  email: string
  online_at: string
}

interface BoardStatusContextType {
  isDirty: boolean
  isSaving: boolean
  isOnline: boolean
  onlineUsers: OnlineUser[]
  setIsDirty: (value: boolean) => void
  setIsSaving: (value: boolean) => void
  setIsOnline: (value: boolean) => void
  setOnlineUsers: (users: OnlineUser[]) => void
}

const BoardStatusContext = createContext<BoardStatusContextType | undefined>(undefined)

export function BoardStatusProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  // Initialize online status from navigator
  useEffect(() => {
    setIsOnline(navigator.onLine)
  }, [])

  return (
    <BoardStatusContext.Provider
      value={{
        isDirty,
        isSaving,
        isOnline,
        onlineUsers,
        setIsDirty,
        setIsSaving,
        setIsOnline,
        setOnlineUsers,
      }}
    >
      {children}
    </BoardStatusContext.Provider>
  )
}

export function useBoardStatus() {
  const context = useContext(BoardStatusContext)
  if (context === undefined) {
    throw new Error('useBoardStatus must be used within a BoardStatusProvider')
  }
  return context
}

// Optional hook that returns null if context is not available
export function useBoardStatusOptional() {
  return useContext(BoardStatusContext)
}
