'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { slugify, generateUniqueSlug } from '@/lib/utils/slug'
import { redirect } from 'next/navigation'

export interface Board {
  id: string
  slug: string
  name: string
  elements: any[]
  app_state: any
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string }

/**
 * Get all boards for the authenticated user
 */
export async function getBoards(): Promise<ActionResult<Board[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Get boards error:', error)
      return { error: 'Failed to fetch boards' }
    }

    return { data: data || [] }
  } catch (err) {
    console.error('Get boards error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get a single board by slug
 */
export async function getBoard(slug: string): Promise<ActionResult<Board>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return { error: 'Board not found' }
      }
      console.error('Get board error:', error)
      return { error: 'Failed to fetch board' }
    }

    if (!data) {
      return { error: 'Board not found' }
    }

    return { data }
  } catch (err) {
    console.error('Get board error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Create a new board
 */
export async function createBoard(
  name: string
): Promise<ActionResult<Board>> {
  const supabase = await createClient()

  // Server-side validation
  const trimmedName = name.trim()
  if (!trimmedName || trimmedName.length === 0) {
    return { error: 'Board name cannot be empty or only whitespace' }
  }

  if (trimmedName.length > 100) {
    return { error: 'Board name must be 100 characters or less' }
  }

  try {
    // Generate base slug from name + timestamp for uniqueness
    const baseSlug = slugify(`${trimmedName}-${Date.now()}`)

    // Check for existing slugs and generate unique one if needed
    const { data: existingBoards } = await supabase
      .from('boards')
      .select('slug')

    const existingSlugs = (existingBoards || []).map((b) => b.slug)
    const uniqueSlug = generateUniqueSlug(baseSlug, existingSlugs)

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('boards')
      .insert({
        name: trimmedName,
        slug: uniqueSlug,
        elements: [],
        app_state: {},
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (error) {
      // Handle constraint violations (duplicate slug)
      if (error.code === '23505') {
        // Retry with a new unique slug
        const retrySlug = generateUniqueSlug(
          `${baseSlug}-${Date.now()}`,
          existingSlugs
        )
        const { data: retryData, error: retryError } = await supabase
          .from('boards')
          .insert({
            name: trimmedName,
            slug: retrySlug,
            elements: [],
            app_state: {},
            created_by: user?.id || null,
          })
          .select()
          .single()

        if (retryError) {
          console.error('Create board retry error:', retryError)
          return { error: 'Failed to create board. Please try again.' }
        }

        revalidatePath('/')
        return { data: retryData }
      }

      console.error('Create board error:', error)
      return { error: 'Failed to create board. Please try again.' }
    }

    revalidatePath('/')
    return { data }
  } catch (err) {
    console.error('Create board error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Update a board
 */
export async function updateBoard(
  slug: string,
  updates: {
    name?: string
    elements?: any[]
    app_state?: any
  }
): Promise<ActionResult<Board>> {
  const supabase = await createClient()

  // Validate name if provided
  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim()
    if (!trimmedName || trimmedName.length === 0) {
      return { error: 'Board name cannot be empty or only whitespace' }
    }

    if (trimmedName.length > 100) {
      return { error: 'Board name must be 100 characters or less' }
    }
  }

  try {
    const updateData: any = {}

    if (updates.name !== undefined) {
      updateData.name = updates.name.trim()
    }

    if (updates.elements !== undefined) {
      updateData.elements = updates.elements
    }

    if (updates.app_state !== undefined) {
      updateData.app_state = updates.app_state
    }

    const { data, error } = await supabase
      .from('boards')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { error: 'Board not found' }
      }
      console.error('Update board error:', error)
      return { error: 'Failed to update board' }
    }

    if (!data) {
      return { error: 'Board not found' }
    }

    revalidatePath('/')
    revalidatePath(`/board/${slug}`)
    return { data }
  } catch (err) {
    console.error('Update board error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a board
 */
export async function deleteBoard(slug: string): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('boards').delete().eq('slug', slug)

    if (error) {
      if (error.code === 'PGRST116') {
        // Board already deleted (concurrent deletion)
        revalidatePath('/')
        return { data: undefined }
      }
      console.error('Delete board error:', error)
      return { error: 'Failed to delete board' }
    }

    revalidatePath('/')
    return { data: undefined }
  } catch (err) {
    console.error('Delete board error:', err)
    return { error: 'An unexpected error occurred' }
  }
}
