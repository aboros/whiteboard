import { Metadata } from 'next'
import { AuthForm } from '@/components/auth/AuthForm'
import { requestMagicLink } from '@/lib/actions/auth'
import { LoginError } from '@/components/auth/LoginError'

export const metadata: Metadata = {
  title: 'Login | Whiteboard',
  description: 'Sign in to your whiteboard account',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
            Whiteboard
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sign in with a magic link sent to your email
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 space-y-4">
          {searchParams.error && <LoginError error={searchParams.error} />}
          <AuthForm onSubmit={requestMagicLink} />
        </div>
      </div>
    </div>
  )
}
