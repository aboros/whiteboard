import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/profile'
import { ProfileEditForm } from '@/components/profile/ProfileEditForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error } = await getProfile()

  if (error) {
    // Still show the form, it will handle creating the profile
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Edit Profile
          </h1>
          <ProfileEditForm userEmail={user.email || ''} profile={null} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Edit Profile
        </h1>
        <ProfileEditForm userEmail={user.email || ''} profile={profile || null} />
      </div>
    </div>
  )
}
