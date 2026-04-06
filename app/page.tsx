// app/page.tsx
import { createClient } from '@/app/utils/supabase/server'
import PublicBoardClient from './PublicBoardClient'
import { Lifter, MeetStatus } from '@/app/types'

export const revalidate = 0

export default async function PublicPage() {
  const supabase = await createClient()

  const { data: lifters } = await supabase.from('lifters').select('*')
  const { data: meetState } = await supabase.from('meet_state').select('*').single()

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:px-4 md:py-6">
      <PublicBoardClient
        initialLifters={lifters as Lifter[] || []}
        initialMeetState={meetState as MeetStatus}
      />
    </main>
  )
}
