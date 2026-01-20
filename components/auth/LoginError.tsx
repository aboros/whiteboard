'use client'

interface LoginErrorProps {
  error: string
}

const errorMessages: Record<string, string> = {
  expired: 'The magic link has expired. Please request a new one.',
  invalid_token: 'Invalid or expired magic link. Please request a new one.',
  invalid_request: 'Invalid request. Please try again.',
  server_error: 'A server error occurred. Please try again later.',
}

export function LoginError({ error }: LoginErrorProps) {
  const message =
    errorMessages[error] ||
    'An error occurred during authentication. Please try again.'

  return (
    <div
      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
      role="alert"
    >
      <p className="text-sm text-red-800 dark:text-red-200">{message}</p>
    </div>
  )
}
