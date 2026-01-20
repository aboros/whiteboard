import { getBoard } from '@/lib/actions/boards'
import { notFound, redirect } from 'next/navigation'

interface BoardPageProps {
  params: Promise<{ slug: string }>
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { slug } = await params

  const result = await getBoard(slug)

  if (result.error) {
    // Board not found - redirect to dashboard
    redirect('/')
  }

  const board = result.data

  // This is a placeholder - the actual Excalidraw integration will be in Task #6
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {board.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Slug: {board.slug}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <p className="text-gray-600 dark:text-gray-400">
            Canvas will be integrated in Task #6 (Excalidraw Canvas Integration)
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Board ID: {board.id}
          </p>
        </div>
      </div>
    </main>
  )
}
