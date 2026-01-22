import { createMiddlewareClient } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient(request, response)

  // Refresh session if expired - required for Server Components
  // This updates cookies but doesn't verify with server
  await supabase.auth.getSession()

  // Verify user authentication with Supabase Auth server (secure)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/auth/callback']
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Board routes can be accessed anonymously (page will check if board is public)
  const isBoardRoute = request.nextUrl.pathname.startsWith('/board/')

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicPath && !isBoardRoute) {
    const redirectUrl = new URL('/login', request.url)
    // Preserve the intended destination for redirect after login
    redirectUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is authenticated and trying to access login page, redirect to dashboard
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Add pathname to headers for conditional rendering in layout
  response.headers.set('x-pathname', request.nextUrl.pathname)

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)'],
}
