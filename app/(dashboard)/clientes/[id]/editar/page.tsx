import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditarClienteForm from './EditarClienteForm'
import { isMolaProfile } from '@/lib/utils'

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
      .select('role, nome')
      .eq('user_id', user.id)
      .single()
  ])

  if (!cliente) notFound()

  const isMola = isMolaProfile(profile)
  if (isMola && cliente.empresa && cliente.empresa !== 'jota_esportivo') {
    redirect('/clientes')
  }

  const isGestor = profile?.role === 'owner' || profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro' || (profile?.nome?.toLowerCase()?.includes('mola') || profile?.nome?.toLowerCase()?.includes('rennan') || profile?.nome?.toLowerCase()?.includes('renan'))
  if (profile?.role === 'design_grafico') redirect('/design')
  if (!isGestor) redirect('/semana')

  return <EditarClienteForm cliente={cliente} isGestor={isGestor} />
}
