'use client'

import { useState, FormEvent } from 'react'

interface AuthFormProps {
  onSubmit: (email: string) => Promise<{ error?: string; success?: boolean }>
  isLoading?: boolean
}

/**
 * RFC 5322 compliant email validation regex
 * This is a simplified version that covers most common email formats
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

export function AuthForm({ onSubmit, isLoading = false }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Client-side validation
    const validation = validateEmail(email)
    if (!validation.valid) {
      setError(validation.error || 'Invalid email')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await onSubmit(email.trim())
      if (result.error) {
        setError(result.error)
        setSuccess(false)
      } else {
        setSuccess(true)
        setEmail('') // Clear email on success
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setSuccess(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitting = isSubmitting || isLoading

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            // Clear error when user starts typing
            if (error) setError(null)
            if (success) setSuccess(false)
          }}
          disabled={submitting}
          placeholder="you@example.com"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          required
          autoComplete="email"
        />
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400" role="alert">
            Check your email for a magic link to sign in.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Sending...' : 'Send magic link'}
      </button>
    </form>
  )
}
