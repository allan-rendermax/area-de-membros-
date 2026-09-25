'use client'

import { useEffect } from 'react'

export function ScrollToMaterials() {
  useEffect(() => {
    // The anchor arrives after the loading boundary; retry once it is mounted.
    if (window.location.hash === '#materiais') {
      document.getElementById('materiais')?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }, [])
  return null
}
