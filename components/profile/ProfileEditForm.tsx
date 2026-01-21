'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateProfile, type UserProfile } from '@/lib/actions/profile'
import { getAvatarUploadPath, deleteAvatar } from '@/lib/actions/avatar'
import { uploadAvatarFromClient } from '@/lib/utils/avatarUpload'
import { getImageDimensions, resizeImageIfNeeded } from '@/lib/utils/image'
import { Avatar } from '@/components/ui/Avatar'

interface ProfileEditFormProps {
  userEmail: string
  profile: UserProfile | null
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_DIMENSION = 512 // 512x512 pixels
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function ProfileEditForm({
  userEmail,
  profile: initialProfile,
}: ProfileEditFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [screenName, setScreenName] = useState(initialProfile?.screen_name || '')
  const [defaultColor, setDefaultColor] = useState(
    initialProfile?.default_color || '#3b82f6'
  )

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Update form when profile changes
  useEffect(() => {
    if (initialProfile) {
      setScreenName(initialProfile.screen_name || '')
      setDefaultColor(initialProfile.default_color || '#3b82f6')
    }
  }, [initialProfile])

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setSelectedFile(null)
    setPreviewUrl(null)

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      )
      return
    }

    try {
      // Automatically resize image if it exceeds dimensions
      // This also reduces file size
      const resizedFile = await resizeImageIfNeeded(
        file,
        MAX_DIMENSION,
        MAX_DIMENSION,
        0.9 // 90% quality
      )

      // Check file size after resizing
      if (resizedFile.size > MAX_FILE_SIZE) {
        setUploadError(
          `File size is too large (${(resizedFile.size / 1024 / 1024).toFixed(2)}MB). Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB. Please try a smaller image.`
        )
        return
      }

      // Get final dimensions for display
      const { width, height } = await getImageDimensions(resizedFile)

      // Create preview from resized file
      const preview = URL.createObjectURL(resizedFile)
      setPreviewUrl(preview)
      setSelectedFile(resizedFile)
    } catch (err) {
      console.error('Error processing image:', err)
      setUploadError('Failed to process image. Please try again.')
    }
  }

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Not authenticated')
        return
      }

      // Preserve existing avatar URL if no new file is selected
      let finalAvatarUrl: string | null = initialProfile?.avatar_url || null

      // If a file is selected, upload it first
      if (selectedFile) {
        // Get upload path from server
        const fileExt = selectedFile.name.split('.').pop() || 'jpg'
        const { data: pathData, error: pathError } = await getAvatarUploadPath(
          user.id,
          fileExt
        )

        if (pathError || !pathData) {
          setError(pathError || 'Failed to generate upload path')
          return
        }

        // Upload directly from client to Supabase Storage
        const { data: uploadData, error: uploadError } =
          await uploadAvatarFromClient(selectedFile, pathData.fileName)

        if (uploadError || !uploadData) {
          setError(uploadError || 'Failed to upload avatar')
          return
        }

        finalAvatarUrl = uploadData.url

        // Delete old avatar if it exists and is from our storage
        if (initialProfile?.avatar_url) {
          await deleteAvatar(initialProfile.avatar_url, user.id)
        }
      }

      // Update profile
      const { data, error: updateError } = await updateProfile({
        screen_name: screenName.trim() || null,
        avatar_url: finalAvatarUrl,
        default_color: defaultColor,
      })

      if (updateError) {
        setError(updateError)
        return
      }

      setSuccess(true)
      // Clear file selection
      handleRemoveFile()
      // Refresh the page to show updated profile
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const displayName = screenName || userEmail

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success message */}
      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            Profile updated successfully!
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Avatar Upload - Click to upload */}
      <div>
        <div className="flex items-center gap-4">
          {/* Clickable Avatar Preview */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group flex-shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"
            aria-label="Upload avatar image"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Avatar preview"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 transition-opacity group-hover:opacity-75"
              />
            ) : (
              <Avatar
                avatarUrl={initialProfile?.avatar_url}
                screenName={screenName}
                email={userEmail}
                defaultColor={defaultColor}
                size="lg"
                displayName={displayName}
                className="transition-opacity group-hover:opacity-75"
              />
            )}
            {/* Edit overlay on hover */}
            <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            id="avatarFile"
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* File info and remove button */}
          <div className="flex-1">
            {selectedFile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
                {uploadError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {uploadError}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Click avatar to upload
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Max {MAX_FILE_SIZE / 1024 / 1024}MB, {MAX_DIMENSION}x{MAX_DIMENSION}px. Large images will be automatically resized.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Screen Name and Default Color - Side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Screen Name */}
        <div>
          <label
            htmlFor="screenName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Screen Name
          </label>
          <input
            type="text"
            id="screenName"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            maxLength={50}
            placeholder="Enter your display name"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This name will be displayed instead of your email. Leave empty to use
            your email.
          </p>
        </div>

        {/* Default Color */}
        <div>
          <label
            htmlFor="defaultColor"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Default Color
          </label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              id="defaultColor"
              value={defaultColor}
              onChange={(e) => setDefaultColor(e.target.value)}
              className="w-16 h-10 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={defaultColor}
              onChange={(e) => setDefaultColor(e.target.value)}
              placeholder="#3b82f6"
              pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This color is used for your cursor highlighting and avatar background
            if no avatar URL is provided.
          </p>
        </div>
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Email
        </label>
        <input
          type="email"
          value={userEmail}
          disabled
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Email cannot be changed. Contact an administrator if you need to update
          your email.
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
