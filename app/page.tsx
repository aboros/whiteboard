import { getBoards } from '@/lib/actions/boards'
import { DashboardClient } from '@/components/boards/DashboardClient'

export default async function DashboardPage() {
  const result = await getBoards()

  if (result.error) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">
              {result.error}
            </p>
          </div>
        </div>
      </main>
    )
  }

  const boards = result.data || []

  return <DashboardClient initialBoards={boards} />
}
