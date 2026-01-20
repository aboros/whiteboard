'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Validate email format (RFC 5322 compliant)
 */
function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' }
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' }
  }

  return { valid: true }
}

/**
 * Request magic link authentication
 */
export async function requestMagicLink(
  email: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    // Server-side validation
    const validation = validateEmail(email)
    if (!validation.valid) {
      return { error: validation.error || 'Invalid email format' }
    }

    const supabase = await createClient()

    // Get the site URL from environment or use localhost as fallback
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_URL ||
      'http://localhost:3000'

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    })

    if (error) {
      console.error('Magic link error:', error)
      // Don't expose specific error details to users for security
      return {
        error: 'Failed to send magic link. Please check your email and try again.',
      }
    }

    return { success: true }
  } catch (err) {
    console.error('Unexpected error in requestMagicLink:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign out error:', error)
      return { error: 'Failed to sign out. Please try again.' }
    }

    revalidatePath('/', 'layout')
    return {}
  } catch (err) {
    console.error('Unexpected error in signOut:', err)
    return { error: 'An unexpected error occurred during sign out.' }
  }
}
