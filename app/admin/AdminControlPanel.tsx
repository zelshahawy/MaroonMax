'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { MeetStatus, MovementType } from '../types/index'

const movementTabs: MovementType[] = ['squat', 'bench', 'deadlift']
const roundTabs: Array<MeetStatus['current_round']> = [1, 2, 3]

export default function AdminControlPanel({ initialMeetState }: { initialMeetState: MeetStatus }) {
  const [state, setState] = useState<MeetStatus>(initialMeetState)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeletingMeet, setIsDeletingMeet] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const isBusy = isSaving || isDeletingMeet

  useEffect(() => {
    const channel = supabase.channel('admin-state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meet_state' },
        (payload) => setState(payload.new as MeetStatus)
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const updateState = async (updates: Partial<MeetStatus>) => {
    if (isBusy) return

    const previousState = state
    setState({ ...state, ...updates })
    setErrorMessage(null)
    setIsSaving(true)

    const { error } = await supabase.from('meet_state').update(updates).eq('id', 1)
    if (error) {
      setState(previousState)
      setErrorMessage(error.message)
    }

    setIsSaving(false)
  }

  const deleteMeetData = async () => {
    if (isDeletingMeet) return

    const shouldDelete = window.confirm('Delete all meet data? This will remove all lifters and reset meet state.')
    if (!shouldDelete) return

    const previousState = state
    const resetState: Partial<MeetStatus> = {
      current_movement: 'squat',
      current_round: 1,
      is_round_active: false,
      is_meet_active: false,
    }

    setErrorMessage(null)
    setState({ ...state, ...resetState })
    setIsDeletingMeet(true)

    const [liftersDeleteResult, meetResetResult] = await Promise.all([
      supabase.from('lifters').delete().not('id', 'is', null),
      supabase.from('meet_state').update(resetState).eq('id', 1),
    ])

    if (liftersDeleteResult.error || meetResetResult.error) {
      setState(previousState)
      setErrorMessage(liftersDeleteResult.error?.message || meetResetResult.error?.message || 'Failed to delete meet data.')
    }

    setIsDeletingMeet(false)
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
    <div className="flex w-full flex-col gap-3">
      <div className="inline-flex w-fit rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
        {movementTabs.map((movement) => {
          const isActive = state.current_movement === movement

          return (
            <button
              key={movement}
              type="button"
              onClick={() => updateState({ current_movement: movement, is_round_active: false })}
              disabled={isBusy}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition ${isActive ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'} disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {movement === 'squat' ? 'Squats' : movement}
            </button>
          )
        })}
      </div>

      <div className="inline-flex w-fit rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
        {roundTabs.map((round) => {
          const isActive = state.current_round === round

          return (
            <button
              key={round}
              type="button"
              onClick={() => updateState({ current_round: round, is_round_active: false })}
              disabled={isBusy}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition ${isActive ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'} disabled:cursor-not-allowed disabled:opacity-70`}
            >
              Round {round}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <button
          onClick={() => updateState({ is_meet_active: true })}
          disabled={isBusy || state.is_meet_active}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${state.is_meet_active ? 'cursor-not-allowed border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-emerald-600 text-white hover:bg-emerald-500'} disabled:cursor-not-allowed disabled:opacity-70`}
        >
          Start Meet
        </button>

        <button
          onClick={() => updateState({ is_meet_active: false, is_round_active: false })}
          disabled={isBusy || !state.is_meet_active}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${state.is_meet_active ? 'bg-rose-600 text-white hover:bg-rose-500' : 'cursor-not-allowed border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'} disabled:cursor-not-allowed disabled:opacity-70`}
        >
          Stop Broadcasting
        </button>

        <button
          onClick={() => updateState({ is_round_active: !state.is_round_active })}
          disabled={isBusy}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {state.is_round_active ? 'Pause Clock' : 'Start Clock'}
        </button>

        <button
          onClick={advanceMeet}
          disabled={isBusy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Advance to {state.current_round === 3 ? 'Next Movement' : `Round ${state.current_round + 1}`}
        </button>

        <button
          onClick={deleteMeetData}
          disabled={isBusy}
          className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/20"
        >
          {isDeletingMeet ? 'Deleting Meet...' : 'Delete Meet Data'}
        </button>
      </div>

      {errorMessage && (
        <p className="w-full rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
