import { createClient } from '@/lib/supabase/server'
import { UserDropdown } from '@/components/auth/UserDropdown'
import { HeaderBreadcrumb } from './HeaderBreadcrumb'
import { getProfile } from '@/lib/actions/profile'

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

  // Get user profile
  const { data: profile } = await getProfile()

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="text-xs px-4 py-1 flex items-center justify-between">
        <HeaderBreadcrumb />
        <UserDropdown userEmail={user.email || ''} profile={profile || null} />
      </div>
    </header>
  )
}
