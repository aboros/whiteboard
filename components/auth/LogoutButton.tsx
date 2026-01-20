'use client'

import { useState } from 'react'
import { signOut } from '@/lib/actions/auth'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      const { error } = await signOut()
      if (error) {
        console.error('Logout error:', error)
        // Still redirect on error - session might be cleared anyway
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

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
