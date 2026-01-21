'use client'

import { useBoardStatusOptional } from './BoardStatusContext'
import { PresenceAvatars } from './PresenceAvatars'

export function BoardStatusIndicators() {
  const status = useBoardStatusOptional()
  
  // Don't render if context is not available (not on a board page)
  if (!status) {
    return null
  }

  const { isDirty, isSaving, isOnline, onlineUsers } = status

  // File icon SVG component
  const FileIcon = ({ color }: { color: string }) => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 2C3.44772 2 3 2.44772 3 3V13C3 13.5523 3.44772 14 4 14H12C12.5523 14 13 13.5523 13 13V5.5L9.5 2H4Z"
        fill={color}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 2V5.5H13"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  // Determine icon color based on status
  let iconColor = 'currentColor'
  if (isSaving) {
    iconColor = '#2563eb' // blue-600
  } else if (!isOnline) {
    iconColor = '#ea580c' // orange-600
  } else if (isDirty) {
    iconColor = '#eab308' // yellow-500
  } else {
    iconColor = '#22c55e' // green-500
  }

  return (
    <div className="flex items-center gap-2">
      {/* Save status indicator - file icon */}
      <div 
        className={`flex items-center ${isSaving ? 'animate-spin' : ''}`}
        title={isSaving ? 'Saving...' : isDirty ? 'Unsaved changes' : !isOnline ? 'Offline' : 'Saved'}
      >
        <FileIcon color={iconColor} />
      </div>

      {/* Presence indicators */}
      <PresenceAvatars onlineUsers={onlineUsers} />
    </div>
  )
}
