'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { MeetStatus } from '../types/index'

export default function AdminControlPanel({ initialMeetState }: { initialMeetState: MeetStatus }) {
  const [state, setState] = useState<MeetStatus>(initialMeetState)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase.channel('admin-state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meet_state' },
        (payload) => setState(payload.new as MeetStatus)
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const updateState = async (updates: Partial<MeetStatus>) => {
    await supabase.from('meet_state').update(updates).eq('id', 1)
  }

  const advanceMeet = () => {
    let nextRound = state.current_round + 1
    let nextMovement = state.current_movement

    if (state.current_round === 3) {
      nextRound = 1
      if (state.current_movement === 'squat') nextMovement = 'bench'
      else if (state.current_movement === 'bench') nextMovement = 'deadlift'
    }

    updateState({ current_round: nextRound as 1 | 2 | 3, current_movement: nextMovement, is_round_active: false })
  }

  return (
    <div className="flex gap-4">
      <button
        onClick={() => updateState({ is_meet_active: !state.is_meet_active })}
        className={`px-4 py-2 font-bold rounded ${state.is_meet_active ? 'bg-red-900 text-red-200' : 'bg-green-600 text-white'}`}
      >
        {state.is_meet_active ? 'End Meet' : 'Start Meet'}
      </button>

      <button
        onClick={() => updateState({ is_round_active: !state.is_round_active })}
        className="px-4 py-2 font-bold rounded bg-slate-700 text-white hover:bg-slate-600"
      >
        {state.is_round_active ? 'Pause Clock' : 'Start Clock'}
      </button>

      <button
        onClick={advanceMeet}
        className="px-6 py-2 font-black uppercase rounded bg-blue-600 text-white shadow-lg hover:bg-blue-500"
      >
        Advance to {state.current_round === 3 ? 'Next Movement' : `Round ${state.current_round + 1}`}
      </button>
    </div>
  )
}
