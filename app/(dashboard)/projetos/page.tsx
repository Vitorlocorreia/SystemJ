import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjetosKanban from '@/components/projetos/ProjetosKanban'

export const metadata = { title: 'Projetos | Jota Esportivo' }

export default async function ProjetosPage() {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only gestores
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  if (!isGestor) redirect('/dashboard')

  const [
    { data: projetos },
    { data: membros },
    { data: clientes },
  ] = await Promise.all([
    supabase
      .from('projetos_kanban')
      .select('*, cliente:clientes(id,nome,email,telefone,segmento,status,created_at), responsavel:profiles!responsavel_id(id,user_id,nome,cargo,role,avatar_url,created_at)')
      .order('ordem', { ascending: true }),
    supabase.from('profiles').select('*').order('nome'),
    supabase.from('clientes').select('id,nome,email,telefone,segmento,status,created_at').eq('status', 'ativo').order('nome'),
  ])

  return (
    <ProjetosKanban
      projetosIniciais={projetos || []}
      membros={membros || []}
      clientes={clientes || []}
      currentUserId={user.id}
    />
  )
}
