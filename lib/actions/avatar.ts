'use server'

import { createClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_DIMENSION = 512 // 512x512 pixels
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Validate image file (basic server-side validation)
 * Note: Dimension validation should be done on client-side before upload
 */
async function validateImageFile(file: File): Promise<{
  valid: boolean
  error?: string
}> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    }
  }

  return { valid: true }
}


/**
 * Get upload path for avatar (server action)
 * This generates the file path that should be used for upload
 */
export async function getAvatarUploadPath(
  userId: string,
  fileExtension: string
): Promise<{ data?: { fileName: string }; error?: string }> {
  try {
    const supabase = await createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== userId) {
      return { error: 'Not authenticated or unauthorized' }
    }

    // Generate unique filename: {userId}/avatar-{timestamp}.{ext}
    const timestamp = Date.now()
    const fileName = `${userId}/avatar-${timestamp}.${fileExtension}`

    return {
      data: {
        fileName,
      },
    }
  } catch (err) {
    console.error('Unexpected error in getAvatarUploadPath:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

/**
 * Delete avatar image from Supabase Storage
 */
export async function deleteAvatar(
  avatarUrl: string,
  userId: string
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== userId) {
      return { error: 'Not authenticated or unauthorized' }
    }

    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/avatars/{userId}/avatar-{timestamp}.{ext}
    const urlParts = avatarUrl.split('/avatars/')
    if (urlParts.length !== 2) {
      // Not a storage URL, might be external URL - nothing to delete
      return {}
    }

    const filePath = urlParts[1]

    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove([filePath])

    if (deleteError) {
      console.error('Delete error:', deleteError)
      // Don't fail if file doesn't exist
      if (deleteError.message?.includes('not found')) {
        return {}
      }
      return { error: 'Failed to delete old avatar' }
    }

    return {}
  } catch (err) {
    console.error('Unexpected error in deleteAvatar:', err)
    // Don't fail the update if deletion fails
    return {}
  }
}
