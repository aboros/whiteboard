/**
 * Slugify utility for converting strings to URL-friendly slugs
 * Handles unicode characters and duplicate slug generation
 */

/**
 * Converts a string to a URL-friendly slug
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes multiple consecutive hyphens
 * - Trims hyphens from start and end
 * - Handles unicode characters (converts to ASCII equivalents where possible)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Normalize unicode characters (NFD = Normalized Form Decomposed)
    .normalize('NFD')
    // Remove diacritical marks (accents, etc.)
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Replace multiple consecutive hyphens with a single hyphen
    .replace(/-+/g, '-')
    // Remove hyphens from start and end
    .replace(/^-+|-+$/g, '')
}

/**
 * Generates a unique slug by appending a number suffix if the slug already exists
 * @param baseSlug - The base slug to check
 * @param existingSlugs - Array of existing slugs to check against
 * @returns A unique slug (e.g., "board", "board-2", "board-3", etc.)
 */
export function generateUniqueSlug(
  baseSlug: string,
  existingSlugs: string[]
): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug
  }

  let counter = 2
  let uniqueSlug = `${baseSlug}-${counter}`

  while (existingSlugs.includes(uniqueSlug)) {
    counter++
    uniqueSlug = `${baseSlug}-${counter}`
  }

  return uniqueSlug
}
