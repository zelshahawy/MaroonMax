'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { Attempt, Lifter, LifterInsert, MeetStatus, MovementType } from '../types'

type AttemptRound = 1 | 2 | 3
type AttemptKey = `${MovementType}_${AttemptRound}`
type ExampleLifter = { name: string }


const rounds: AttemptRound[] = [1, 2, 3]
const REQUEST_TIMEOUT_MS = 10_000

function emptyAttempt(): Attempt {
  return { weight: null, status: 'waiting' }
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    Promise.resolve(promise)
      .then((result) => resolve(result))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timer))
  })
}

function createNewLifterInsert(name: string): LifterInsert {
  return {
    id: crypto.randomUUID(),
    name,
    squat_1: emptyAttempt(),
    squat_2: emptyAttempt(),
    squat_3: emptyAttempt(),
    bench_1: emptyAttempt(),
    bench_2: emptyAttempt(),
    bench_3: emptyAttempt(),
    deadlift_1: emptyAttempt(),
    deadlift_2: emptyAttempt(),
    deadlift_3: emptyAttempt(),
  }
}

function toLocalLifter(insert: LifterInsert): Lifter {
  return {
    ...insert,
    best_squat: 0,
    best_bench: 0,
    best_deadlift: 0,
    total: 0,
  }
}

export default function EditableLiftingBoard({ initialLifters, initialMeetState }: { initialLifters: Lifter[], initialMeetState: MeetStatus }) {
  const [lifters, setLifters] = useState<Lifter[]>(initialLifters)
  const [meetState, setMeetState] = useState<MeetStatus>(initialMeetState)
  const [newLifterName, setNewLifterName] = useState('')
  const [isAddingLifter, setIsAddingLifter] = useState(false)
  const [deletingLifterId, setDeletingLifterId] = useState<string | null>(null)
  const [isAdvancingLifter, setIsAdvancingLifter] = useState(false)
  const [isSeedingExamples, setIsSeedingExamples] = useState(false)
  const [hasSeedAttempted, setHasSeedAttempted] = useState(false)
  const [primedAttemptKey, setPrimedAttemptKey] = useState<AttemptKey | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const m = meetState.current_movement

  const upsertLifter = useCallback((nextLifter: Lifter) => {
    setLifters((prev) => {
      const index = prev.findIndex((lifter) => lifter.id === nextLifter.id)
      if (index === -1) {
        return [...prev, nextLifter]
      }

      const copy = [...prev]
      copy[index] = nextLifter
      return copy
    })
  }, [])

  useEffect(() => {
    const channel = supabase.channel('admin-lifters')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lifters' },
        (payload) => upsertLifter(payload.new as Lifter)
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lifters' },
        (payload) => upsertLifter(payload.new as Lifter)
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lifters' },
        (payload) => setLifters((prev) => prev.filter((lifter) => lifter.id !== (payload.old as { id: string }).id))
      ).subscribe()

    const stateChannel = supabase.channel('admin-state-board')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meet_state' },
        (payload) => setMeetState(payload.new as MeetStatus)
      ).subscribe()

    return () => { supabase.removeChannel(channel); supabase.removeChannel(stateChannel) }
  }, [supabase, upsertLifter])

  const seedFromExamples = useCallback(async () => {
    setIsSeedingExamples(true)
    setErrorMessage(null)

    try {
      const response = await withTimeout(
        fetch('/example-lifters.json', { cache: 'no-store' }),
        REQUEST_TIMEOUT_MS,
        'Timed out while loading `/example-lifters.json`.',
      )
      if (!response.ok) {
        throw new Error('Could not load example lifter data.')
      }

      const examples = await response.json() as ExampleLifter[]
      const rows = examples
        .map((example) => example.name.trim())
        .filter(Boolean)
        .map((name) => createNewLifterInsert(name))

      if (rows.length === 0) {
        throw new Error('No example lifters were found in `/example-lifters.json`.')
      }

      const { data, error } = await withTimeout(
        supabase.from('lifters').insert(rows).select('*'),
        REQUEST_TIMEOUT_MS,
        'Timed out while saving example lifters to Supabase.',
      )

      if (error) {
        throw error
      }

      if (data && data.length > 0) {
        setLifters(data as Lifter[])
        return
      }

      // Fallback for setups where insert works but returning rows is restricted.
      setLifters(rows.map((row) => toLocalLifter(row)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to seed example lifters.'
      setErrorMessage(message)
    } finally {
      setIsSeedingExamples(false)
    }
  }, [supabase])

  useEffect(() => {
    if (lifters.length > 0 || hasSeedAttempted) return
    setHasSeedAttempted(true)
    void seedFromExamples()
  }, [hasSeedAttempted, lifters.length, seedFromExamples])

  const updateAttempt = async (lifterId: string, attemptKey: AttemptKey, newAttemptData: Attempt) => {
    setErrorMessage(null)
    const updates: Array<{ lifterId: string, attempt: Attempt }> = [{ lifterId, attempt: newAttemptData }]

    // Keep only one lifter "on platform" for the active attempt.
    if (newAttemptData.status === 'lifting') {
      lifters.forEach((lifter) => {
        if (lifter.id === lifterId) return
        const attempt = lifter[attemptKey] ?? emptyAttempt()
        if (attempt.status === 'lifting') {
          updates.push({
            lifterId: lifter.id,
            attempt: { ...attempt, status: 'waiting' },
          })
        }
      })
    }

    setLifters((prev) => prev.map((lifter) => {
      const update = updates.find((item) => item.lifterId === lifter.id)
      return update ? { ...lifter, [attemptKey]: update.attempt } : lifter
    }))

    const responses = await Promise.all(
      updates.map((update) => supabase.from('lifters').update({ [attemptKey]: update.attempt }).eq('id', update.lifterId))
    )

    const firstFailure = responses.find((result) => result.error)
    if (firstFailure?.error) {
      setErrorMessage(firstFailure.error.message)
    }
  }

  const addLifter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = newLifterName.trim()
    if (!trimmedName || isAddingLifter) return

    setIsAddingLifter(true)
    setErrorMessage(null)

    const newLifter = createNewLifterInsert(trimmedName)
    const { data, error } = await withTimeout(
      supabase.from('lifters').insert(newLifter).select('*').single(),
      REQUEST_TIMEOUT_MS,
      'Timed out while adding lifter.',
    )

    if (error) {
      setErrorMessage(error.message)
      setIsAddingLifter(false)
      return
    }

    if (data) {
      upsertLifter(data as Lifter)
    } else {
      upsertLifter(toLocalLifter(newLifter))
    }

    setNewLifterName('')
    setIsAddingLifter(false)
  }

  const deleteLifter = async (lifter: Lifter) => {
    if (deletingLifterId) return

    const shouldDelete = window.confirm(`Delete lifter "${lifter.name}"?`)
    if (!shouldDelete) return

    setErrorMessage(null)
    setDeletingLifterId(lifter.id)

    const previousLifters = lifters
    setLifters((prev) => prev.filter((item) => item.id !== lifter.id))

    const { error } = await supabase.from('lifters').delete().eq('id', lifter.id)
    if (error) {
      setLifters(previousLifters)
      setErrorMessage(error.message)
    }

    setDeletingLifterId(null)
  }

  const activeAttemptKey = `${m}_${meetState.current_round}` as AttemptKey
  const sortedLifters = [...lifters].sort((a, b) => {
    const weightA = a[activeAttemptKey]?.weight || 0
    const weightB = b[activeAttemptKey]?.weight || 0
    if (weightA === weightB) return a.name.localeCompare(b.name)
    return weightA - weightB
  })
  const currentLifter = sortedLifters.find((lifter) => (lifter[activeAttemptKey] ?? emptyAttempt()).status === 'lifting')

  const advanceToNextLifter = useCallback(async () => {
    if (isAdvancingLifter || sortedLifters.length === 0) return

    setIsAdvancingLifter(true)
    setErrorMessage(null)

    const currentIndex = sortedLifters.findIndex((lifter) => (lifter[activeAttemptKey] ?? emptyAttempt()).status === 'lifting')
    let nextIndex = -1

    if (currentIndex >= 0) {
      for (let index = currentIndex + 1; index < sortedLifters.length; index += 1) {
        const status = sortedLifters[index][activeAttemptKey]?.status ?? 'waiting'
        if (status === 'waiting') {
          nextIndex = index
          break
        }
      }
    }

    if (nextIndex === -1) {
      nextIndex = sortedLifters.findIndex((lifter) => (lifter[activeAttemptKey]?.status ?? 'waiting') === 'waiting')
    }

    if (nextIndex === -1) {
      nextIndex = currentIndex >= 0 ? currentIndex : 0
    }

    const updates: Array<{ lifterId: string, attempt: Attempt }> = []

    if (currentIndex >= 0 && currentIndex !== nextIndex) {
      const currentAttempt = sortedLifters[currentIndex][activeAttemptKey] ?? emptyAttempt()
      if (currentAttempt.status === 'lifting') {
        updates.push({
          lifterId: sortedLifters[currentIndex].id,
          attempt: { ...currentAttempt, status: 'waiting' },
        })
      }
    }

    const nextAttempt = sortedLifters[nextIndex][activeAttemptKey] ?? emptyAttempt()
    if (nextAttempt.status !== 'lifting') {
      updates.push({
        lifterId: sortedLifters[nextIndex].id,
        attempt: { ...nextAttempt, status: 'lifting' },
      })
    }

    if (updates.length === 0) {
      setIsAdvancingLifter(false)
      return
    }

    setLifters((prev) => prev.map((lifter) => {
      const update = updates.find((item) => item.lifterId === lifter.id)
      return update ? { ...lifter, [activeAttemptKey]: update.attempt } : lifter
    }))

    const responses = await Promise.all(
      updates.map((update) => supabase.from('lifters').update({ [activeAttemptKey]: update.attempt }).eq('id', update.lifterId))
    )

    const firstFailure = responses.find((result) => result.error)
    if (firstFailure?.error) {
      setErrorMessage(firstFailure.error.message)
    }

    setIsAdvancingLifter(false)
  }, [activeAttemptKey, isAdvancingLifter, sortedLifters, supabase])

  useEffect(() => {
    if (primedAttemptKey === activeAttemptKey) return
    if (sortedLifters.length === 0) return

    setPrimedAttemptKey(activeAttemptKey)
    const hasCurrentLifter = sortedLifters.some((lifter) => (lifter[activeAttemptKey] ?? emptyAttempt()).status === 'lifting')

    if (!hasCurrentLifter) {
      void advanceToNextLifter()
    }
  }, [activeAttemptKey, advanceToNextLifter, primedAttemptKey, sortedLifters])

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold capitalize text-slate-900 dark:text-slate-100">{m}</h2>

        <div className="flex w-full max-w-2xl flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void advanceToNextLifter()}
            disabled={isAdvancingLifter || sortedLifters.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isAdvancingLifter ? 'Advancing...' : 'Next Lifter'}
          </button>

          <p className="min-w-[220px] flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Current Lifter: <span className="font-semibold text-slate-900 dark:text-slate-100">{currentLifter?.name ?? 'Not set'}</span>
          </p>

          <form onSubmit={addLifter} className="flex w-full max-w-md items-center gap-2">
            <input
              value={newLifterName}
              onChange={(event) => setNewLifterName(event.target.value)}
              placeholder="Lifter name"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={isAddingLifter}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Add Lifter
            </button>
          </form>
        </div>
      </div>

      {isSeedingExamples && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          No lifters found. Pulling example lifters from `/example-lifters.json`...
        </p>
      )}

      {!isSeedingExamples && lifters.length === 0 && (
        <button
          type="button"
          onClick={() => void seedFromExamples()}
          className="mb-4 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Retry Loading Examples
        </button>
      )}

      {errorMessage && (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {errorMessage}
        </p>
      )}

      <div className="space-y-3">
        {sortedLifters.map(lifter => {
          const isCurrentLifter = (lifter[activeAttemptKey] ?? emptyAttempt()).status === 'lifting'

          return (
          <div
            key={lifter.id}
            className={`flex items-center justify-between rounded-md border p-4 transition-all ${isCurrentLifter ? 'animate-pulse border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}
          >
            <div className="flex w-60 items-center gap-3">
              <div className={`text-xl font-semibold ${isCurrentLifter ? 'text-amber-900 dark:text-amber-200' : 'text-slate-900 dark:text-slate-100'}`}>
                {lifter.name}
              </div>
              <button
                type="button"
                onClick={() => void deleteLifter(lifter)}
                disabled={deletingLifterId === lifter.id}
                className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
              >
                {deletingLifterId === lifter.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>

            <div className="flex gap-4">
              {rounds.map(round => {
                const attemptKey = `${m}_${round}` as AttemptKey
                const attemptData = lifter[attemptKey] ?? emptyAttempt()
                const isActive = meetState.current_round === round

                return (
                  <div key={round} className={`flex flex-col items-center gap-2 rounded-md border p-3 ${isActive ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}>
                    <input
                      type="number"
                      value={attemptData?.weight ?? ''}
                      onChange={(event) => updateAttempt(lifter.id, attemptKey, {
                        ...attemptData,
                        weight: event.target.value === '' ? null : Number(event.target.value),
                      })}
                      placeholder="kg"
                      className="w-24 rounded-md border border-slate-300 bg-white p-2 text-center text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />

                    <div className="flex gap-2">
                      <button type="button" onClick={() => updateAttempt(lifter.id, attemptKey, { ...attemptData, status: 'lifting' })} className={`h-8 w-8 rounded-full ${attemptData?.status === 'lifting' ? 'bg-amber-400 ring-2 ring-white dark:ring-slate-900' : 'bg-amber-200 dark:bg-amber-900/60'}`} title="Lifting" />
                      <button type="button" onClick={() => updateAttempt(lifter.id, attemptKey, { ...attemptData, status: 'success' })} className={`h-8 w-8 rounded-full ${attemptData?.status === 'success' ? 'bg-emerald-500 ring-2 ring-white dark:ring-slate-900' : 'bg-emerald-200 dark:bg-emerald-900/60'}`} title="Good Lift" />
                      <button type="button" onClick={() => updateAttempt(lifter.id, attemptKey, { ...attemptData, status: 'fail' })} className={`h-8 w-8 rounded-full ${attemptData?.status === 'fail' ? 'bg-rose-500 ring-2 ring-white dark:ring-slate-900' : 'bg-rose-200 dark:bg-rose-900/60'}`} title="No Lift" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}
