import { useEffect, useState } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { createClient } from './utils/supabase/client'
import { Lifter, MeetStatus, Attempt } from './types/index'


const columnHelper = createColumnHelper<Lifter>()

export default function PublicBoardClient({ initialLifters, initialMeetState }: { initialLifters: Lifter[], initialMeetState: MeetStatus }) {
  const [data, setData] = useState<Lifter[]>(initialLifters);
  const [meetState, setMeetState] = useState<MeetStatus>(initialMeetState);
  const supabase = createClient()

  const m = meetState?.current_movement || 'squat'

  const columns = [
    columnHelper.accessor('name', {
      header: 'Lifter',
      cell: info => <span className="font-bold text-lg">{info.getValue()}</span>,
    }),
    columnHelper.accessor(row => (row as any)[`${m}_1`]?.weight, {
      id: `${m}_1`, header: 'Attempt 1',
      cell: info => <AttemptCell attempt={(info.row.original as any)[`${m}_1`]} />
    }),
    columnHelper.accessor(row => (row as any)[`${m}_2`]?.weight, {
      id: `${m}_2`, header: 'Attempt 2',
      cell: info => <AttemptCell attempt={(info.row.original as any)[`${m}_2`]} />
    }),
    columnHelper.accessor(row => (row as any)[`${m}_3`]?.weight, {
      id: `${m}_3`, header: 'Attempt 3',
      cell: info => <AttemptCell attempt={(info.row.original as any)[`${m}_3`]} />
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lifters' },
        (payload) => setData(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lifter : l))
      ).subscribe()

    const stateChannel = supabase.channel('public-state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meet_state' },
        (payload) => setMeetState(payload.new as MeetStatus)
      ).subscribe()

    return () => { supabase.removeChannel(liftersChannel); supabase.removeChannel(stateChannel) }
  }, [supabase])

  if (!meetState) return <div className="text-white p-10 font-bold">Loading Meet Data...</div>

  if (!meetState.is_meet_active) {
    return <div className="flex h-screen items-center justify-center text-4xl font-black uppercase text-white">Meet Starting Soon</div>
  }

  return (
    <div className="mx-auto max-w-6xl w-full">
      <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-800 p-6 text-white shadow-lg">
        <h1 className="text-3xl font-black uppercase tracking-wider text-red-500">
          {m} <span className="text-white">- Round {meetState.current_round}</span>
        </h1>
        <div className={`rounded-full px-4 py-1 text-sm font-bold ${meetState.is_round_active ? 'bg-green-500' : 'bg-yellow-500 text-black'}`}>
          {meetState.is_round_active ? 'CLOCK RUNNING' : 'ROUND PAUSED'}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-xl">
        <table className="w-full border-collapse">
          <thead className="bg-slate-100 border-b-2 border-slate-200">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th key={header.id} className="p-4 text-left font-bold text-slate-600 uppercase">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="p-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AttemptCell({ attempt }: { attempt?: Attempt }) {
  if (!attempt || attempt.weight === null) return <span className="text-slate-300 font-bold">---</span>

  const styles = {
    waiting: "bg-slate-100 text-slate-700",
    lifting: "animate-pulse bg-yellow-400 text-yellow-900 shadow-[0_0_15px_rgba(250,204,21,0.6)] border-2 border-yellow-500",
    success: "bg-green-500 text-white",
    fail: "bg-red-500 text-white"
  }

  return (
    <div className={`inline-block w-24 rounded-md px-4 py-2 text-center font-bold transition-all duration-300 ${styles[attempt.status]}`}>
      {attempt.weight} kg
    </div>
  )
}

