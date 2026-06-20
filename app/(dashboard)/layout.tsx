import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/shared/Sidebar'
import { Toaster } from 'sonner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: '#1A1A1A',
            border: '1px solid #2A2A2A',
            color: '#FFFFFF',
          },
        }}
      />
    </div>
  )
}
