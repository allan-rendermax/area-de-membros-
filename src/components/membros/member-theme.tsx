'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { MemberThemeName } from '@/lib/membros/theme'

const ThemeContext = createContext<MemberThemeName>(undefined)
export const useMemberTheme = () => useContext(ThemeContext)

export function MemberTheme({ theme, children, className = '' }: {
  theme?: MemberThemeName
  children?: ReactNode
  className?: string
}) {
  return (
    <ThemeContext value={theme}>
      <div data-member-theme={theme} className={`min-h-dvh bg-fundo text-texto ${className}`}>{children}</div>
    </ThemeContext>
  )
}
