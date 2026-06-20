import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditarClienteForm from './EditarClienteForm'

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [{ data: cliente }, { data: profile }] = await Promise.all([
    supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()
  ])

  if (!cliente) notFound()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'

  return <EditarClienteForm cliente={cliente} isGestor={isGestor} />
}
