'use client'

interface AvatarProps {
  /** URL to the avatar image */
  avatarUrl?: string | null
  /** Screen name to display or generate initials from */
  screenName?: string | null
  /** Email address (fallback for initials if screen name not available) */
  email: string
  /** Default color for avatar background (hex format) */
  defaultColor?: string
  /** Size of the avatar */
  size?: 'sm' | 'md' | 'lg'
  /** Display name (for alt text and title) */
  displayName?: string
  /** Additional CSS classes */
  className?: string
  /** Whether to show a border */
  border?: boolean
}

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-20 h-20 text-lg',
}

/**
 * Reusable Avatar component that handles:
 * - Displaying avatar image if available
 * - Falling back to initials (from screen name or email)
 * - Using default color for background
 * - Consistent sizing and styling
 */
export function Avatar({
  avatarUrl,
  screenName,
  email,
  defaultColor,
  size = 'md',
  displayName,
  className = '',
  border = true,
}: AvatarProps) {
  // Get display name for alt text and title
  const finalDisplayName = displayName || screenName || email

  // Get initials from screen name or email
  const getInitials = (): string => {
    if (screenName) {
      const parts = screenName.split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return screenName.substring(0, 1).toUpperCase()
    }
    const parts = email.split('@')[0].split(/[._-]/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return email.substring(0, 1).toUpperCase()
  }

  // Get avatar background color
  const getAvatarColor = (): string => {
    if (defaultColor) {
      return defaultColor
    }
    // Fallback to generated color based on email
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
    let hash = 0
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const avatarColor = getAvatarColor()
  const isHexColor = avatarColor.startsWith('#')
  const sizeClasses = SIZE_CLASSES[size]
  const borderClass = border
    ? 'border-2 border-gray-200 dark:border-gray-700'
    : ''

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={finalDisplayName}
        title={finalDisplayName}
        className={`${sizeClasses} rounded-full object-cover ${borderClass} ${className}`}
        onError={(e) => {
          // Fallback to initials if image fails to load
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent && !parent.querySelector('.avatar-fallback')) {
            const fallback = document.createElement('div')
            fallback.className = `avatar-fallback ${sizeClasses} rounded-full flex items-center justify-center text-white font-medium ${borderClass} ${className} ${
              isHexColor ? '' : avatarColor
            }`
            if (isHexColor) {
              fallback.style.backgroundColor = avatarColor
            }
            fallback.textContent = getInitials()
            fallback.title = finalDisplayName
            parent.appendChild(fallback)
          }
        }}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses} rounded-full flex items-center justify-center text-white font-medium ${borderClass} ${className} ${
        isHexColor ? '' : avatarColor
      }`}
      style={isHexColor ? { backgroundColor: avatarColor } : undefined}
      title={finalDisplayName}
    >
      {getInitials()}
    </div>
  )
}
