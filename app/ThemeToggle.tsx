'use client'

import { useEffect } from 'react'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export default function ThemeToggle() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const resolvedTheme: Theme =
      savedTheme === 'light' || savedTheme === 'dark'
        ? savedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'

    applyTheme(resolvedTheme)
    localStorage.setItem('theme', resolvedTheme)
  }, [])

  const toggleTheme = () => {
    const currentTheme: Theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark'
    applyTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 md:right-4 md:top-4"
      aria-label="Toggle light and dark mode"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 dark:hidden"
        aria-hidden="true"
      >
        <path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden h-4 w-4 dark:block"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
      <span className="sr-only">Toggle light and dark mode</span>
    </button>
  )
}
