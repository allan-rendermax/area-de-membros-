'use client'

import { useEffect, useEffectEvent, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMemberTheme } from './member-theme'

type ModalProps = {
  open: boolean
  onClose: () => void
  labelledBy: string
  children?: ReactNode
  className?: string
  backdropClassName?: string
}

const subscribe = () => () => {}
const dialogs: HTMLElement[] = []
let unlockPage: (() => void) | undefined

function lockPage(overlay: HTMLElement) {
  const body = document.body
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const previous = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right }
  const background = [...body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== overlay)
  const inert = background.map((node) => node.inert)
  background.forEach((node) => { node.inert = true })
  Object.assign(body.style, { overflow: 'hidden', position: 'fixed', top: `-${scrollY}px`, left: '0', right: '0' })
  return () => {
    Object.assign(body.style, previous)
    background.forEach((node, index) => { node.inert = inert[index] })
    window.scrollTo(scrollX, scrollY)
  }
}

function controls(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
    .filter((node) => {
      if (node.tabIndex < 0 || node.matches(':disabled') || node.closest('[hidden], [inert]')) return false
      for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        if (ancestor === panel) break
      }
      return true
    })
}

function ModalContent({ onClose, labelledBy, children, className = 'max-w-lg', backdropClassName = 'bg-fundo/80' }: Omit<ModalProps, 'open'>) {
  const theme = useMemberTheme()
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(onClose)

  useEffect(() => {
    const panel = panelRef.current!
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialogs.length === 0) unlockPage = lockPage(panel.parentElement!)
    dialogs.push(panel)
    const focusFirst = () => (controls(panel)[0] ?? panel).focus({ preventScroll: true })
    focusFirst()
    const isTop = () => dialogs.at(-1) === panel
    const onKey = (event: KeyboardEvent) => {
      if (!isTop()) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
      } else if (event.key === 'Tab') {
        const targets = controls(panel)
        const first = targets[0]
        const last = targets.at(-1)
        if (!first) {
          event.preventDefault()
          panel.focus({ preventScroll: true })
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
          event.preventDefault()
          last!.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    const onFocus = (event: FocusEvent) => {
      if (isTop() && !panel.contains(event.target as Node)) focusFirst()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      const wasTop = isTop()
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocus)
      dialogs.splice(dialogs.indexOf(panel), 1)
      if (dialogs.length === 0) {
        unlockPage?.()
        unlockPage = undefined
      }
      if (wasTop && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div
      data-member-theme={theme}
      className={`fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 ${backdropClassName}`}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}
        className={`painel-sobe max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-xl bg-superficie sm:rounded-xl ${className}`}>
        {children}
      </div>
    </div>
  )
}

export function Modal({ open, ...props }: ModalProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  return open && mounted ? createPortal(<ModalContent {...props} />, document.body) : null
}
