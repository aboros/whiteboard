'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'

interface OnlineUser {
  user_id: string
  email: string
  online_at: string
}

interface UserProfile {
  user_id: string
  screen_name: string | null
  avatar_url: string | null
  default_color: string
}

interface PresenceAvatarsProps {
  onlineUsers: OnlineUser[]
}

/**
 * PresenceAvatars component displays user presence indicators in the corner of the board.
 * Shows user emails/avatars for all users currently viewing the board.
 * Handles multi-tab deduplication (same user in multiple tabs shows once).
 * Uses user profiles for colors and display names when available.
 */
export function PresenceAvatars({ onlineUsers }: PresenceAvatarsProps) {
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map())

  // Fetch profiles for all online users
  useEffect(() => {
    async function fetchProfiles() {
      if (onlineUsers.length === 0) return

      const supabase = createClient()
      const userIds = onlineUsers.map((u) => u.user_id)

      // Fetch all profiles in one query
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, screen_name, avatar_url, default_color')
        .in('user_id', userIds)

      if (error) {
        console.error('Error fetching profiles:', error)
        return
      }

      // Create a map of user_id -> profile
      const profileMap = new Map<string, UserProfile>()
      if (data) {
        data.forEach((profile) => {
          profileMap.set(profile.user_id, profile)
        })
      }

      setProfiles(profileMap)
    }

    fetchProfiles()
  }, [onlineUsers])

  if (onlineUsers.length === 0) {
    return null
  }

  // Get display name (screen_name or email)
  const getDisplayName = (user: OnlineUser, profile?: UserProfile): string => {
    return profile?.screen_name || user.email
  }

  return (
    <div className="flex items-center gap-1.5">
      {onlineUsers.map((user) => {
        const profile = profiles.get(user.user_id)
        const displayName = getDisplayName(user, profile)

        return (
          <div
            key={user.user_id}
            className="flex items-center group relative"
            title={displayName}
          >
            <Avatar
              avatarUrl={profile?.avatar_url}
              screenName={profile?.screen_name}
              email={user.email}
              defaultColor={profile?.default_color}
              size="sm"
              displayName={displayName}
            />
            {/* Display name tooltip on hover */}
            <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50 pointer-events-none">
              {displayName}
            </div>
          </div>
        )
      })}
    </div>
  )
}
