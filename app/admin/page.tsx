import { createClient } from '../utils/supabase/server'
import AdminControlPanel from './AdminControlPanel'
import EditableLiftingBoard from './EditableLiftingBoard'
import { Lifter, MeetStatus } from '../types'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: lifters } = await supabase.from('lifters').select('*')
  const { data: meetState } = await supabase.from('meet_state').select('*').single()

  if (!meetState) return <div>Please setup your database first.</div>

  return (
    <div className="min-h-screen bg-slate-900 p-4 text-slate-100 md:p-8">
      <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-red-500">Meet Director</h1>
          <p className="text-slate-400">Main Control Dashboard</p>
        </div>
        <AdminControlPanel initialMeetState={meetState as MeetStatus} />
      </header>

      <EditableLiftingBoard initialLifters={lifters as Lifter[] || []} initialMeetState={meetState as MeetStatus} />
    </div>
  )
}
