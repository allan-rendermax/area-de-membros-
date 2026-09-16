import { AdminLoginForm } from './form'

export default function AdminEntrarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">Admin</h1>
        <AdminLoginForm />
      </div>
    </main>
  )
}
