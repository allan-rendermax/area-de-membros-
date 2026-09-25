'use client'

import { useEffect, useRef } from 'react'
import { recordVisit } from '@/app/[loja]/historico/actions'

export function RecordItemVisit({ storeSlug, itemId }: { storeSlug: string; itemId: string }) {
  const lastVisit = useRef<string | null>(null)
  useEffect(() => {
    const visit = `${storeSlug}:${itemId}`
    // State survives router.refresh and StrictMode's effect replay. Leaving the
    // page unmounts this component, so returning is a new visit.
    if (lastVisit.current === visit) return
    lastVisit.current = visit
    void recordVisit(storeSlug, itemId).catch(() => {})
  }, [storeSlug, itemId])
  return null
}
