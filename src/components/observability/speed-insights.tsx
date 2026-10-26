'use client'

import { SpeedInsights } from '@vercel/speed-insights/next'
import { sanitizeSpeedInsightsEvent } from '@/lib/observability/speed-insights'

export function MemberSpeedInsights() {
  return <SpeedInsights beforeSend={sanitizeSpeedInsightsEvent} debug={false} />
}
