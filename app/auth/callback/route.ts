import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/'

  const supabase = await createClient()

  // Handle magic link with code (primary flow)
  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Code exchange error:', error)
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set(
          'error',
          error.message?.includes('expired') || error.message?.includes('invalid')
            ? 'expired'
            : 'invalid_token'
        )
        return NextResponse.redirect(redirectUrl)
      }

      // Successful authentication - redirect to dashboard
      return NextResponse.redirect(new URL(next, request.url))
    } catch (err) {
      console.error('Unexpected error in code exchange:', err)
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('error', 'server_error')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Handle OTP token_hash flow (fallback for direct OTP)
  if (token_hash && type) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        type: type as any,
        token_hash,
      })

      if (error) {
        console.error('OTP verification error:', error)
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set(
          'error',
          error.message === 'Token has expired or is invalid'
            ? 'expired'
            : 'invalid_token'
        )
        return NextResponse.redirect(redirectUrl)
      }

      // Successful authentication - redirect to dashboard
      return NextResponse.redirect(new URL(next, request.url))
    } catch (err) {
      console.error('Unexpected error in OTP verification:', err)
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('error', 'server_error')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Missing required parameters - log for debugging
  console.error('Missing callback parameters:', {
    code: code ? 'present' : 'missing',
    token_hash: token_hash ? 'present' : 'missing',
    type: type ? 'present' : 'missing',
    url: requestUrl.toString(),
  })

  const redirectUrl = new URL('/login', request.url)
  redirectUrl.searchParams.set('error', 'invalid_request')
  return NextResponse.redirect(redirectUrl)
}
