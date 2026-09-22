'use client'

import { useState, useSyncExternalStore } from 'react'
import { DownloadIcon } from './icons'
import { Modal } from './modal'

type InstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: InstallPromptEvent | null = null
let installed = false
let registered = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function register() {
  if (registered || typeof window === 'undefined') return
  registered = true

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
}

function subscribe(listener: () => void) {
  register()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const noopSubscribe = () => () => {}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function InstallAppButton({ className = '' }: { className?: string }) {
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => true)
  const ios = useSyncExternalStore(noopSubscribe, isIos, () => false)
  const installPrompt = useSyncExternalStore(subscribe, () => deferredPrompt, () => null)
  const isInstalled = useSyncExternalStore(subscribe, () => installed, () => false)
  const [helpOpen, setHelpOpen] = useState(false)

  if (standalone || isInstalled || (!installPrompt && !ios)) return null

  async function install() {
    if (!installPrompt) {
      setHelpOpen(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') installed = true
    deferredPrompt = null
    notify()
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          void install()
        }}
        className={`inline-flex items-center gap-2 rounded-full border border-borda bg-superficie-2 px-3 py-1.5 text-sm font-medium text-texto hover:bg-borda ${className}`}
      >
        <DownloadIcon />
        Instalar app
      </button>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} labelledBy="instalar-titulo" className="max-w-md p-6" backdropClassName="bg-fundo/70">
        <h2 id="instalar-titulo" className="text-xl font-bold">Instalar no iPhone</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-texto-suave">
          <li>Abra este site no <strong className="text-texto">Safari</strong>.</li>
          <li>Toque em <strong className="text-texto">Compartilhar</strong> (o quadrado com uma seta para cima).</li>
          <li>Escolha <strong className="text-texto">Adicionar à Tela de Início</strong> e toque em <strong className="text-texto">Adicionar</strong>.</li>
        </ol>
        <button type="button" onClick={() => setHelpOpen(false)} className="mt-6 w-full rounded-md bg-destaque px-4 py-3 font-semibold text-texto hover:bg-destaque-hover">
          Entendi
        </button>
      </Modal>
    </>
  )
}
