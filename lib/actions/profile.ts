'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface UserProfile {
  id: string
  user_id: string
  screen_name: string | null
  avatar_url: string | null
  default_color: string
  created_at: string
  updated_at: string
}

/**
 * Get user profile, creating one if it doesn't exist
 */
export async function getProfile(): Promise<{
  data?: UserProfile
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Try to get existing profile
    let { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If profile doesn't exist, create one
    if (error && error.code === 'PGRST116') {
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          default_color: '#3b82f6', // Default blue
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating profile:', insertError)
        return { error: 'Failed to create profile' }
      }

      return { data: newProfile as UserProfile }
    }

    if (error) {
      console.error('Error fetching profile:', error)
      return { error: 'Failed to fetch profile' }
    }

    return { data: profile as UserProfile }
  } catch (err) {
    console.error('Unexpected error in getProfile:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Update user profile
 */
export async function updateProfile(
  updates: Partial<{
    screen_name: string | null
    avatar_url: string | null
    default_color: string
  }>
): Promise<{ data?: UserProfile; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Validate screen_name length
    if (updates.screen_name !== undefined) {
      if (updates.screen_name && updates.screen_name.length > 50) {
        return { error: 'Screen name must be 50 characters or less' }
      }
    }

    // Validate default_color format (hex color)
    if (updates.default_color) {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
      if (!hexColorRegex.test(updates.default_color)) {
        return { error: 'Invalid color format. Use hex format (e.g., #3b82f6)' }
      }
    }

    // Ensure profile exists first
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          screen_name: updates.screen_name ?? null,
          avatar_url: updates.avatar_url ?? null,
          default_color: updates.default_color ?? '#3b82f6',
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating profile:', createError)
        return { error: 'Failed to create profile' }
      }

      revalidatePath('/', 'layout')
      return { data: newProfile as UserProfile }
    }

    // Update existing profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return { error: 'Failed to update profile' }
    }

    revalidatePath('/', 'layout')
    return { data: updatedProfile as UserProfile }
  } catch (err) {
    console.error('Unexpected error in updateProfile:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get profile by user_id (for displaying other users' profiles)
 */
export async function getProfileByUserId(
  userId: string
): Promise<{ data?: UserProfile; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile doesn't exist - return null data (not an error)
        return { data: undefined }
      }
      console.error('Error fetching profile:', error)
      return { error: 'Failed to fetch profile' }
    }

    return { data: profile as UserProfile }
  } catch (err) {
    console.error('Unexpected error in getProfileByUserId:', err)
    return { error: 'An unexpected error occurred' }
  }
}
