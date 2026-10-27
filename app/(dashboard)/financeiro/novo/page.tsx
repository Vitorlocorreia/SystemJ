import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NovoLancamentoForm from './NovoLancamentoForm'
import { isMolaProfile } from '@/lib/utils'

export default async function NovoLancamentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, nome')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'owner' || profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro' || (profile?.nome?.toLowerCase()?.includes('mola') || profile?.nome?.toLowerCase()?.includes('rennan') || profile?.nome?.toLowerCase()?.includes('renan'))
  if (profile?.role === 'design_grafico') redirect('/design')
  if (!isGestor) redirect('/semana')

  // Mola é apenas visualizador no financeiro e não pode cadastrar lançamentos
  if (isMolaProfile(profile)) {
    redirect('/financeiro')
  }

  // Fetch financial categories, clients, and projects
  const [
    { data: categorias },
    { data: clientes },
    { data: projetos }
  ] = await Promise.all([
    supabase.from('categorias_financeiro').select('id, nome, tipo, cor').order('nome'),
    supabase.from('clientes').select('id, nome').order('nome'),
    supabase.from('projetos').select('id, nome').order('nome'),
  ])

  return (
    <NovoLancamentoForm
      categorias={categorias ?? []}
      clientes={clientes ?? []}
      projetos={projetos ?? []}
    />
  )
}
