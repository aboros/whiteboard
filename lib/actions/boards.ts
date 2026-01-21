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
  is_public: boolean
  created_at: string
  updated_at: string
}

export type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string }

export interface SharedUser {
  id: string
  email: string
  shared_at: string
}

export type ShareResult =
  | { success: true; warning?: string }
  | { success: false; error: string; warning?: string }

export interface BoardsResult {
  owned: Board[]
  shared: Board[]
}

/**
 * Get all boards for the authenticated user, separated into owned and shared
 */
export async function getBoards(): Promise<ActionResult<BoardsResult>> {
  try {
    const supabase = await createClient()

    // Refresh session first (required for Server Components)
    await supabase.auth.getSession()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('Get user error:', userError)
      return { error: 'Failed to authenticate user' }
    }

    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Get owned boards
    const { data: ownedBoards, error: ownedError } = await supabase
      .from('boards')
      .select('*')
      .eq('created_by', user.id)
      .order('updated_at', { ascending: false })

    if (ownedError) {
      console.error('Get owned boards error:', ownedError)
      console.error('Error details:', {
        message: ownedError.message,
        code: ownedError.code,
        details: ownedError.details,
        hint: ownedError.hint,
        user_id: user.id,
      })
      // Return a more user-friendly error message
      if (ownedError.code === '42501') {
        return { error: 'Permission denied. Please try logging out and back in.' }
      }
      return { error: `Failed to fetch owned boards: ${ownedError.message || 'Unknown error'}` }
    }

    // Get shared boards via board_shares join
    const { data: sharedBoards, error: sharedError } = await supabase
      .from('board_shares')
      .select(
        `
        board:board_id (
          id,
          slug,
          name,
          elements,
          app_state,
          created_by,
          is_public,
          created_at,
          updated_at
        )
      `
      )
      .eq('shared_with_user_id', user.id)
      .order('created_at', { ascending: false })

    if (sharedError) {
      console.error('Get shared boards error:', sharedError)
      return { error: 'Failed to fetch shared boards' }
    }

    // Extract board data from the join result
    const shared = (sharedBoards || [])
      .map((share: any) => share.board)
      .filter((board: any) => board !== null)
      .sort(
        (a: Board, b: Board) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )

    return {
      data: {
        owned: ownedBoards || [],
        shared: shared || [],
      },
    }
  } catch (err) {
    console.error('Get boards error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get a single board by slug (checks ownership, sharing access, or public status)
 */
export async function getBoard(slug: string): Promise<ActionResult<Board>> {
  try {
    const supabase = await createClient()

    // Get current user (may be null for anonymous users)
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    // If board is public, allow access for anyone (including anonymous users)
    if (data.is_public) {
      return { data }
    }

    // For private boards, require authentication
    if (!user) {
      return { error: 'You do not have access to this board' }
    }

    // Check if user has access (owner or shared)
    const isOwner = data.created_by === user.id
    const isShared = isOwner
      ? false
      : await (async () => {
          const { data: share } = await supabase
            .from('board_shares')
            .select('id')
            .eq('board_id', data.id)
            .eq('shared_with_user_id', user.id)
            .single()
          return !!share
        })()

    if (!isOwner && !isShared) {
      return { error: 'You do not have access to this board' }
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

/**
 * Share a board with a user by email
 */
export async function shareBoard(
  boardId: string,
  email: string
): Promise<ShareResult> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify current user is the board owner
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('created_by')
      .eq('id', boardId)
      .single()

    if (boardError || !board) {
      return { success: false, error: 'Board not found' }
    }

    if (board.created_by !== currentUser.id) {
      return { success: false, error: 'Only the board owner can share boards' }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email format' }
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim()

    // Don't allow sharing with yourself
    if (normalizedEmail === currentUser.email?.toLowerCase()) {
      return { success: false, error: 'Cannot share board with yourself' }
    }

    // Look up user by email using database function
    const { data: userData, error: userError } = await supabase.rpc(
      'get_user_by_email',
      { user_email: normalizedEmail }
    )

    if (userError) {
      console.error('Get user by email error:', userError)
      return {
        success: false,
        error: 'Failed to look up user',
        warning: `No user found with email ${email}. They must sign up first.`,
      }
    }

    // Check if user was found
    if (!userData || userData.length === 0) {
      return {
        success: false,
        error: 'User not found',
        warning: `No user found with email ${email}. They must sign up first.`,
      }
    }

    const targetUserId = userData[0].id

    // Check if already shared
    const { data: existingShare } = await supabase
      .from('board_shares')
      .select('id')
      .eq('board_id', boardId)
      .eq('shared_with_user_id', targetUserId)
      .single()

    if (existingShare) {
      return {
        success: false,
        error: 'Board is already shared with this user',
      }
    }

    // Create the share
    const { data: shareData, error: shareError } = await supabase
      .from('board_shares')
      .insert({
        board_id: boardId,
        shared_with_user_id: targetUserId,
        shared_by_user_id: currentUser.id,
      })
      .select()
      .single()

    if (shareError) {
      console.error('Share board error:', shareError)
      return { success: false, error: 'Failed to share board' }
    }

    revalidatePath('/')
    // Get board slug for revalidation
    const { data: boardWithSlug } = await supabase
      .from('boards')
      .select('slug')
      .eq('id', boardId)
      .single()
    if (boardWithSlug) {
      revalidatePath(`/board/${boardWithSlug.slug}`)
    }
    return { success: true }
  } catch (err) {
    console.error('Share board error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Revoke access to a board for a user
 */
export async function revokeBoardAccess(
  boardId: string,
  userId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (!currentUser) {
      return { error: 'Not authenticated' }
    }

    // Verify current user is the board owner
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('created_by')
      .eq('id', boardId)
      .single()

    if (boardError || !board) {
      return { error: 'Board not found' }
    }

    if (board.created_by !== currentUser.id) {
      return { error: 'Only the board owner can revoke access' }
    }

    // Delete the share
    const { error: deleteError } = await supabase
      .from('board_shares')
      .delete()
      .eq('board_id', boardId)
      .eq('shared_with_user_id', userId)

    if (deleteError) {
      console.error('Revoke access error:', deleteError)
      return { error: 'Failed to revoke access' }
    }

    revalidatePath('/')
    return { data: undefined }
  } catch (err) {
    console.error('Revoke access error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get list of users a board is shared with
 */
export async function getSharedUsers(
  boardId: string
): Promise<ActionResult<SharedUser[]>> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (!currentUser) {
      return { error: 'Not authenticated' }
    }

    // Verify current user is the board owner
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('created_by')
      .eq('id', boardId)
      .single()

    if (boardError || !board) {
      return { error: 'Board not found' }
    }

    if (board.created_by !== currentUser.id) {
      return { error: 'Only the board owner can view shared users' }
    }

    // Get shares with user emails using database function
    const { data: sharesData, error: sharesError } = await supabase.rpc(
      'get_board_shared_users',
      { board_uuid: boardId }
    )

    if (sharesError) {
      console.error('Get shared users error:', sharesError)
      return { error: 'Failed to fetch shared users' }
    }

    const sharedUsers: SharedUser[] =
      sharesData?.map((share: any) => ({
        id: share.user_id,
        email: share.user_email || 'Unknown',
        shared_at: share.shared_at,
      })) || []

    return { data: sharedUsers }
  } catch (err) {
    console.error('Get shared users error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get share count for a board
 */
export async function getBoardShareCount(
  boardId: string
): Promise<ActionResult<number>> {
  try {
    const supabase = await createClient()

    const { count, error } = await supabase
      .from('board_shares')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId)

    if (error) {
      console.error('Get share count error:', error)
      return { error: 'Failed to fetch share count' }
    }

    return { data: count || 0 }
  } catch (err) {
    console.error('Get share count error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Toggle public status of a board
 */
export async function setBoardPublicStatus(
  boardId: string,
  isPublic: boolean
): Promise<ActionResult<Board>> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (!currentUser) {
      return { error: 'Not authenticated' }
    }

    // Verify current user is the board owner
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('created_by, slug')
      .eq('id', boardId)
      .single()

    if (boardError || !board) {
      return { error: 'Board not found' }
    }

    if (board.created_by !== currentUser.id) {
      return { error: 'Only the board owner can change public status' }
    }

    // Update public status
    const { data: updatedBoard, error: updateError } = await supabase
      .from('boards')
      .update({ is_public: isPublic })
      .eq('id', boardId)
      .select()
      .single()

    if (updateError) {
      console.error('Set public status error:', updateError)
      return { error: 'Failed to update public status' }
    }

    revalidatePath('/')
    if (board.slug) {
      revalidatePath(`/board/${board.slug}`)
    }
    return { data: updatedBoard }
  } catch (err) {
    console.error('Set public status error:', err)
    return { error: 'An unexpected error occurred' }
  }
}
