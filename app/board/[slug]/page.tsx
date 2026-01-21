import { getBoard } from '@/lib/actions/boards'
import { redirect } from 'next/navigation'
import { ExcalidrawWrapper } from '@/components/canvas/ExcalidrawWrapper'

interface BoardPageProps {
  params: Promise<{ slug: string }>
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { slug } = await params

  const result = await getBoard(slug)

  if (result.error || !result.data) {
    // Board not found - redirect to dashboard
    redirect('/')
  }

  const board = result.data

  // Ensure elements and app_state are properly initialized
  const elements = Array.isArray(board.elements) ? board.elements : []
  const appState = board.app_state && typeof board.app_state === 'object' ? board.app_state : {}

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]">
      {/* Excalidraw Canvas - fills remaining space below header */}
      <div className="flex-1 relative overflow-hidden">
        <ExcalidrawWrapper
          initialElements={elements}
          initialAppState={appState}
          boardSlug={board.slug}
          boardName={board.name}
        />
      </div>
    </div>
  )
}
