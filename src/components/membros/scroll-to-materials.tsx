'use client'

import { useEffect } from 'react'

export function ScrollToMaterials() {
  useEffect(() => {
    // Wait for the streamed DOM and Next's own scroll restoration to settle.
    if (window.location.hash !== '#materiais') return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('materiais')?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return null
}
