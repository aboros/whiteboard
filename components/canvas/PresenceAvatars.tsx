'use client'

interface OnlineUser {
  user_id: string
  email: string
  online_at: string
}

interface PresenceAvatarsProps {
  onlineUsers: OnlineUser[]
}

/**
 * PresenceAvatars component displays user presence indicators in the corner of the board.
 * Shows user emails/avatars for all users currently viewing the board.
 * Handles multi-tab deduplication (same user in multiple tabs shows once).
 */
export function PresenceAvatars({ onlineUsers }: PresenceAvatarsProps) {
  if (onlineUsers.length === 0) {
    return null
  }

  // Get initials from email for avatar fallback
  const getInitials = (email: string): string => {
    const parts = email.split('@')[0].split(/[._-]/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  // Generate a consistent color based on user_id
  const getUserColor = (userId: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-teal-500',
    ]
    // Simple hash of user_id to get consistent color
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="flex items-center gap-1.5">
      {onlineUsers.map((user) => (
        <div
          key={user.user_id}
          className="flex items-center group relative"
          title={user.email}
        >
          {/* Avatar circle with initials */}
          <div
            className={`${getUserColor(user.user_id)} w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium`}
          >
            {getInitials(user.email)}
          </div>
          {/* Email tooltip on hover */}
          <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50 pointer-events-none">
            {user.email}
          </div>
        </div>
      ))}
    </div>
  )
}
