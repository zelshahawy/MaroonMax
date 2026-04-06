import { createClient } from '../utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AdminControlPanel from './AdminControlPanel'
import EditableLiftingBoard from './EditableLiftingBoard'
import { Lifter, MeetStatus } from '../types'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: lifters } = await supabase.from('lifters').select('*')
  const { data: meetState } = await supabase.from('meet_state').select('*').single()

  if (!meetState) return <div>Please setup your database first.</div>

  return (
    <div className="min-h-screen bg-slate-100 px-2 py-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:px-4 md:py-6">
      <div className="mx-auto flex w-full max-w-375 flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AdminControlPanel initialMeetState={meetState as MeetStatus} />
          </CardContent>
        </Card>

        <EditableLiftingBoard initialLifters={lifters as Lifter[] || []} initialMeetState={meetState as MeetStatus} />
      </div>
    </div>
  )
}
