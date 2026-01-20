'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CreateBoardDialog } from './CreateBoardDialog'
import { useRouter } from 'next/navigation'

export function CreateBoardButton() {
  const [showDialog, setShowDialog] = useState(false)
  const router = useRouter()

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create Board
      </button>

      <CreateBoardDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSuccess={handleSuccess}
      />
    </>
  )
}
