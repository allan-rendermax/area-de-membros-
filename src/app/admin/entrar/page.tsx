import { ui } from '@/components/admin/ui'
import { AdminLoginForm } from './form'

export default function AdminEntrarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-fundo px-4">
      <div className={`${ui.card} w-full max-w-sm p-6 sm:p-8`}>
        <h1 className="mb-6 text-2xl font-bold">Admin</h1>
        <AdminLoginForm />
      </div>
    </main>
  )
}
