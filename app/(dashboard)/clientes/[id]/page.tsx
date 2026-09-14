import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import MesaClienteView from '@/components/clientes/MesaClienteView'

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [
    { data: cliente },
    { data: projetos },
    { data: projetosKanban },
    { data: interacoes },
    { data: profile },
    { data: tarefasDoCliente },
    { data: membros }
  ] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', id).single(),
    supabase.from('projetos').select('id, nome, status, prazo, responsavel:profiles(nome)').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase.from('projetos_kanban').select('id, titulo, status, prazo, responsavel:profiles!responsavel_id(nome)').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase.from('interacoes').select('*, autor:profiles(nome)').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('role').eq('user_id', user.id).single(),
    supabase.from('tarefas').select('*, responsavel:profiles(*), projeto:projetos!projeto_id(cliente_id)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('nome')
  ])

  if (!cliente) notFound()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  if (profile?.role === 'design_grafico') redirect('/design')

  // Filter tarefas that belong to this client
  const demandasDoCliente = (tarefasDoCliente as any[] | null)?.filter(
    (t: any) => t.projeto?.cliente_id === id || t.cliente_id === id
  ) ?? []

  return (
    <MesaClienteView
      cliente={cliente}
      projetos={projetos || []}
      projetosKanban={projetosKanban || []}
      tarefas={demandasDoCliente}
      interacoes={interacoes || []}
      membros={membros || []}
      currentUserId={user.id}
      isGestor={isGestor}
    />
  )
}
