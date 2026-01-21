'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import Link from 'next/link'
import type { UserProfile } from '@/lib/actions/profile'
import { Avatar } from '@/components/ui/Avatar'

interface UserDropdownProps {
  userEmail: string
  profile?: UserProfile | null
}

export function UserDropdown({ userEmail, profile }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      const { error } = await signOut()
      if (error) {
        console.error('Logout error:', error)
      }
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Unexpected logout error:', err)
      router.push('/login')
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  // Get display name (screen_name or email)
  const displayName = profile?.screen_name || userEmail

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        {/* Avatar */}
        <Avatar
          avatarUrl={profile?.avatar_url}
          screenName={profile?.screen_name}
          email={userEmail}
          defaultColor={profile?.default_color}
          size="sm"
          displayName={displayName}
          border={false}
        />
        {/* Email/Name */}
        <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[150px] truncate">
          {displayName}
        </span>
        {/* Dropdown arrow */}
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50">
          <div className="py-1">
            {/* User info */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {userEmail}
              </p>
            </div>

            {/* Profile link */}
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Edit Profile
            </Link>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
