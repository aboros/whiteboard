/**
 * Client-side avatar upload utility
 * Uploads directly from browser to Supabase Storage
 */

import { createClient } from '@/lib/supabase/client'

/**
 * Upload avatar image directly from client to Supabase Storage
 * This must be called from a client component
 */
export async function uploadAvatarFromClient(
  file: File,
  fileName: string
): Promise<{ data?: { url: string; path: string }; error?: string }> {
  if (typeof window === 'undefined') {
    throw new Error('uploadAvatarFromClient can only be called on the client side')
  }

  try {
    const supabase = createClient()

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false, // Don't overwrite - create new file each time
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { error: 'Failed to upload image. Please try again.' }
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(fileName)

    return {
      data: {
        url: publicUrl,
        path: uploadData.path,
      },
    }
  } catch (err) {
    console.error('Unexpected error in uploadAvatarFromClient:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}
