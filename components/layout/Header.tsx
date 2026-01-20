import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/auth/LogoutButton'

export async function Header() {
  const supabase = await createClient()
  
  // Verify user authentication with Supabase Auth server (secure)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Only show header if user is authenticated
  if (!user) {
    return null
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Whiteboard
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
