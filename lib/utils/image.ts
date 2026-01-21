/**
 * Client-side image utility functions
 * These must be called from client components only
 */

/**
 * Get image dimensions from file (client-side only)
 * This must be called from a client component
 */
export function getImageDimensions(file: File): Promise<{
  width: number
  height: number
}> {
  if (typeof window === 'undefined') {
    throw new Error('getImageDimensions can only be called on the client side')
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: img.width,
        height: img.height,
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Resize image to fit within max dimensions while maintaining aspect ratio
 * Returns a new File with the resized image
 */
export async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.9
): Promise<File> {
  if (typeof window === 'undefined') {
    throw new Error('resizeImage can only be called on the client side')
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img
      const aspectRatio = width / height

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          width = maxWidth
          height = maxWidth / aspectRatio
        } else {
          height = maxHeight
          width = maxHeight * aspectRatio
        }
      }

      // If no resizing needed, return original file
      if (width === img.width && height === img.height) {
        resolve(file)
        return
      }

      // Create canvas and resize
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create resized image'))
            return
          }

          // Create new File with same name and type
          const resizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          })

          resolve(resizedFile)
        },
        file.type,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Resize image if it exceeds max dimensions, otherwise return original
 * This is a convenience function that combines dimension check and resize
 */
export async function resizeImageIfNeeded(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.9
): Promise<File> {
  const { width, height } = await getImageDimensions(file)

  // Only resize if dimensions exceed limits
  if (width > maxWidth || height > maxHeight) {
    return resizeImage(file, maxWidth, maxHeight, quality)
  }

  return file
}
