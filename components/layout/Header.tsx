import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { HeaderBreadcrumb } from './HeaderBreadcrumb'

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
      <div className="text-xs px-4 py-1 flex items-center justify-between">
        <HeaderBreadcrumb />
        <div className="flex items-center gap-2">
          <span className="text-gray-600 dark:text-gray-400">
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
