'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { Lifter, MeetStatus, Attempt, } from '../types'

export default function EditableLiftingBoard({ initialLifters, initialMeetState }: { initialLifters: Lifter[], initialMeetState: MeetStatus }) {
  const [lifters, setLifters] = useState<Lifter[]>(initialLifters)
  const [meetState, setMeetState] = useState<MeetStatus>(initialMeetState)
  const supabase = createClient()
  const m = meetState.current_movement

  useEffect(() => {
    const channel = supabase.channel('admin-lifters')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lifters' },
        (payload) => setLifters(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lifter : l))
      ).subscribe()

    const stateChannel = supabase.channel('admin-state-board')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meet_state' },
        (payload) => setMeetState(payload.new as MeetStatus)
      ).subscribe()

    return () => { supabase.removeChannel(channel); supabase.removeChannel(stateChannel) }
  }, [supabase])

  const updateAttempt = async (lifterId: string, attemptKey: string, newAttemptData: Attempt) => {
    setLifters(prev => prev.map(l => l.id === lifterId ? { ...l, [attemptKey]: newAttemptData } : l))
    await supabase.from('lifters').update({ [attemptKey]: newAttemptData }).eq('id', lifterId)
  }

  const sortedLifters = [...lifters].sort((a, b) => {
    const weightA = (a as any)[`${m}_${meetState.current_round}`]?.weight || 0
    const weightB = (b as any)[`${m}_${meetState.current_round}`]?.weight || 0
    if (weightA === weightB) return a.name.localeCompare(b.name)
    return weightA - weightB
  })

  return (
    <div className="w-full rounded-lg bg-slate-800 p-6 shadow-xl">
      <h2 className="mb-6 text-2xl font-bold uppercase text-white">{m} Control Panel</h2>
      <div className="space-y-3">
        {sortedLifters.map(lifter => (
          <div key={lifter.id} className="flex items-center justify-between rounded bg-slate-700 p-4">
            <div className="w-48 text-xl font-bold text-white">{lifter.name}</div>

            <div className="flex gap-4">
              {[1, 2, 3].map(round => {
                const attemptKey = `${m}_${round}`
                const attemptData = (lifter as any)[attemptKey] as Attempt
                const isActive = meetState.current_round === round

                return (
                  <div key={round} className={`flex flex-col items-center gap-2 rounded border-2 p-3 ${isActive ? 'border-blue-500 bg-slate-600' : 'border-transparent bg-slate-800'}`}>
                    <input
                      type="number"
                      value={attemptData?.weight || ''}
                      onChange={(e) => updateAttempt(lifter.id, attemptKey, { ...attemptData, weight: Number(e.target.value) })}
                      placeholder="kg"
                      className="w-24 rounded bg-slate-900 p-2 text-center font-bold text-white"
                    />

                    <div className="flex gap-2">
                      <button onClick={() => updateAttempt(lifter.id, attemptKey, { ...attemptData, status: 'lifting' })} className={`h-8 w-8 rounded-full ${attemptData?.status === 'lifting' ? 'bg-yellow-400 ring-2 ring-white' : 'bg-yellow-900'}`} title="Lifting" />
                      <button onClick={() => updateAttempt(lifter.id, attemptKey, { ...attemptData, status: 'success' })} className={`h-8 w-8 rounded-full ${attemptData?.status === 'success' ? 'bg-green-500 ring-2 ring-white' : 'bg-green-900'}`} title="Good Lift" />
                      <button onClick={() => updateAttempt(lifter.id, attemptKey, { ...attemptData, status: 'fail' })} className={`h-8 w-8 rounded-full ${attemptData?.status === 'fail' ? 'bg-red-500 ring-2 ring-white' : 'bg-red-900'}`} title="No Lift" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
