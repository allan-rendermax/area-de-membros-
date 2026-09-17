'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { DownloadIcon } from './icons'

type InstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
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
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (standalone || installed || (!installPrompt && !ios)) return null

  async function install() {
    if (!installPrompt) {
      setHelpOpen(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-full border border-borda bg-superficie-2 px-3 py-1.5 text-sm font-medium text-texto hover:bg-borda ${className}`}
      >
        <DownloadIcon />
        Instalar app
      </button>

      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="instalar-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-fundo/70 sm:items-center sm:p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div className="painel-sobe w-full max-w-md rounded-t-xl bg-superficie p-6 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="instalar-titulo" className="text-xl font-bold">Instalar no iPhone</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-texto-suave">
              <li>Abra este site no <strong className="text-texto">Safari</strong>.</li>
              <li>Toque em <strong className="text-texto">Compartilhar</strong> (o quadrado com uma seta para cima).</li>
              <li>Escolha <strong className="text-texto">Adicionar à Tela de Início</strong> e toque em <strong className="text-texto">Adicionar</strong>.</li>
            </ol>
            <button type="button" onClick={() => setHelpOpen(false)} className="mt-6 w-full rounded-md bg-destaque px-4 py-3 font-semibold text-texto hover:bg-destaque-hover">
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  )
}
