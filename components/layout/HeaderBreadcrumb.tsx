'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getBoard } from '@/lib/actions/boards'
import { BoardStatusIndicators } from '@/components/canvas/BoardStatusIndicators'

export function HeaderBreadcrumb() {
  const pathname = usePathname()
  const isBoardPage = pathname.startsWith('/board/')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (isBoardPage) {
      // Extract slug from pathname (e.g., "/board/my-board" -> "my-board")
      const slug = pathname.split('/board/')[1]?.split('/')[0]
      if (slug) {
        // Fetch board name client-side
        getBoard(slug).then((result) => {
          if (result.data) {
            setTitle(result.data.name)
          }
        })
      }
    } else {
      setTitle('')
    }
  }, [pathname, isBoardPage])

  return (
    <div className="flex items-center gap-3">
      <h1 className="font-bold text-gray-900 dark:text-white">
        <Link 
          href="/" 
          className="hover:underline text-gray-900 dark:text-white"
        >
          Boards
        </Link>
        {isBoardPage && title && ` » ${title}`}
      </h1>
      {isBoardPage && <BoardStatusIndicators />}
    </div>
  )
}
