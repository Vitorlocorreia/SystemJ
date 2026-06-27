import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import RegistrarInteracaoForm from './RegistrarInteracaoForm'

export default async function RegistrarInteracaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome')
    .eq('id', id)
    .single()

  if (!cliente) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  if (profile?.role === 'design_grafico') redirect('/design')
  if (!isGestor) redirect('/semana')

  return <RegistrarInteracaoForm clienteId={cliente.id} clienteNome={cliente.nome} />
}
