"use client"
import { useEffect, useMemo, useState } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { createClient } from './utils/supabase/client'
import { Attempt, Lifter, MeetStatus, MovementType } from './types/index'


const columnHelper = createColumnHelper<Lifter>()
type AttemptRound = 1 | 2 | 3
type AttemptKey = `${MovementType}_${AttemptRound}`

function getAttempt(lifter: Lifter, movement: MovementType, round: AttemptRound): Attempt {
  const key = `${movement}_${round}` as AttemptKey
  return lifter[key]
}

export default function PublicBoardClient({ initialLifters, initialMeetState }: { initialLifters: Lifter[], initialMeetState: MeetStatus }) {
  const [data, setData] = useState<Lifter[]>(initialLifters);
  const [meetState, setMeetState] = useState<MeetStatus>(initialMeetState);
  const supabase = useMemo(() => createClient(), [])

  const m = meetState?.current_movement || 'squat'
  const movementLabel = m.toUpperCase()
  const currentRound = meetState?.current_round || 1
  const currentLifterName = data.find((lifter) => getAttempt(lifter, m, currentRound)?.status === 'lifting')?.name ?? 'Waiting...'

  const columns = [
    columnHelper.accessor('name', {
      header: 'Lifter',
      cell: info => <span className="text-2xl font-semibold tracking-wide text-slate-900 dark:text-slate-100">{info.getValue()}</span>,
    }),
    columnHelper.accessor(row => getAttempt(row, m, 1)?.weight, {
      id: `${m}_1`, header: 'Attempt 1',
      cell: info => <AttemptCell attempt={getAttempt(info.row.original, m, 1)} />
    }),
    columnHelper.accessor(row => getAttempt(row, m, 2)?.weight, {
      id: `${m}_2`, header: 'Attempt 2',
      cell: info => <AttemptCell attempt={getAttempt(info.row.original, m, 2)} />
    }),
    columnHelper.accessor(row => getAttempt(row, m, 3)?.weight, {
      id: `${m}_3`, header: 'Attempt 3',
      cell: info => <AttemptCell attempt={getAttempt(info.row.original, m, 3)} />
    }),
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting: [
        { id: `${m}_${meetState?.current_round || 1}`, desc: false },
        { id: 'name', desc: false }
      ],
    },
  })

  useEffect(() => {
    const liftersChannel = supabase.channel('public-lifters')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lifters' },
        (payload) => setData(prev => prev.some(l => l.id === payload.new.id) ? prev : [...prev, payload.new as Lifter])
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lifters' },
        (payload) => setData(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lifter : l))
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lifters' },
        (payload) => setData(prev => prev.filter(l => l.id !== (payload.old as { id: string }).id))
      ).subscribe()

    const stateChannel = supabase.channel('public-state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meet_state' },
        (payload) => setMeetState(payload.new as MeetStatus)
      ).subscribe()

    return () => { supabase.removeChannel(liftersChannel); supabase.removeChannel(stateChannel) }
  }, [supabase])

  if (!meetState) {
    return (
      <Card className="mx-auto mt-6 w-full">
        <CardContent className="p-10 text-center">
          <p className="text-xl font-medium text-slate-700 dark:text-slate-300">Loading meet data...</p>
        </CardContent>
      </Card>
    )
  }

  if (!meetState.is_meet_active) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-4xl font-semibold text-slate-900 dark:text-slate-100 md:text-5xl">
          Meet starting soon
        </p>
      </div>
    )
  }

  const statusClasses = meetState.is_round_active
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'

  return (
    <div className="mx-auto w-full max-w-none space-y-3">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardDescription className="text-sm uppercase tracking-wide">Platform</CardDescription>
            <CardTitle className="mt-1 text-4xl font-semibold text-slate-900 dark:text-slate-100 md:text-5xl">
              {movementLabel} Round {currentRound}
            </CardTitle>
            <CardDescription className="mt-2 flex items-center gap-2 text-base text-slate-600 dark:text-slate-300">
              <span className={cn('h-2 w-2 rounded-full', meetState.is_round_active ? 'animate-pulse bg-emerald-500' : 'bg-amber-500')} />
              On Platform: <span className="font-semibold text-slate-900 dark:text-slate-100">{currentLifterName}</span>
            </CardDescription>
          </div>
          <Badge className={cn('text-sm', statusClasses)}>
            {meetState.is_round_active ? 'Round Active' : 'Round Paused'}
          </Badge>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-base md:text-lg">
              <TableHeader className="bg-slate-50 dark:bg-slate-800/70">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id} className={header.id === 'name' ? 'min-w-[320px] text-sm md:text-base' : 'min-w-[220px] text-center text-sm md:text-base'}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => {
                  const isLiftingNow = getAttempt(row.original, m, currentRound)?.status === 'lifting'
                  return (
                    <TableRow key={row.id} className={isLiftingNow ? 'bg-amber-50 dark:bg-amber-950/30' : 'dark:border-slate-800'}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cell.column.id === 'name' ? 'py-5 font-medium text-slate-900 dark:text-slate-100' : 'py-5'}>
                          {cell.column.id === 'name' ? (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          ) : (
                            <div className="flex w-full justify-center">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AttemptCell({ attempt }: { attempt?: Attempt }) {
  if (!attempt || attempt.weight === null) {
    return <Badge className="min-w-[120px] justify-center px-3 py-2 text-lg font-semibold tabular-nums border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 md:text-xl">---</Badge>
  }

  const styles: Record<Attempt['status'], string> = {
    waiting: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    lifting: 'animate-pulse border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
    success: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
    fail: 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300',
  }

  return (
    <Badge className={cn('min-w-[120px] justify-center px-3 py-2 text-lg font-bold tabular-nums md:text-xl', styles[attempt.status])}>
      {attempt.weight} kg
    </Badge>
  )
}
