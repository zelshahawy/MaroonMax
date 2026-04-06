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
    <main className="min-h-screen bg-slate-900 p-4 md:p-8">
      <PublicBoardClient
        initialLifters={lifters as Lifter[] || []}
        initialMeetState={meetState as MeetStatus}
      />
    </main>
  )
}
