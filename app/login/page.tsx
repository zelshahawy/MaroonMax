import { createClient } from '../utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message: string }> }) {
  const params = await searchParams;
  const signIn = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return redirect('/login?message=Invalid credentials')
    }
    return redirect('/admin')
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <form action={signIn} className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-black uppercase text-gray-800">Admin Login</h1>

        <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="email">Email</label>
        <input className="mb-4 w-full rounded border px-3 py-2" name="email" type="email" required />

        <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="password">Password</label>
        <input className="mb-6 w-full rounded border px-3 py-2" name="password" type="password" required />

        <button className="w-full rounded bg-red-600 py-2 font-bold text-white transition hover:bg-red-700">
          Sign In
        </button>

        {params?.message && (
          <p className="mt-4 rounded bg-red-100 p-2 text-center text-sm text-red-700">
            {params.message}
          </p>
        )}
      </form>
    </div>
  )

}
