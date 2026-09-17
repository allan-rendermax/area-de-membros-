'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { withMessage } from '@/lib/admin/action-helpers'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { resendEmailLogEntry, resendFailedEmails } from '@/lib/email/server'

export async function reenviarEmLote() {
  await requireAdmin()
  const s = await resendFailedEmails()
  revalidatePath('/admin/emails')
  redirect(
    withMessage(
      '/admin/emails',
      `Reenvio concluído: ${s.sent} enviados, ${s.failed} falharam, ${s.skipped} sem produtos liberados, ${s.remaining} ficam para depois.`,
    ),
  )
}

export async function reenviarEmail(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const result = isUuid(id) ? await resendEmailLogEntry(id) : { ok: false as const, error: 'Registro inválido.' }
  revalidatePath('/admin/emails')
  redirect(withMessage('/admin/emails?filtro=falhou', result.ok ? 'E-mail reenviado.' : `Falha ao reenviar: ${result.error}`))
}
