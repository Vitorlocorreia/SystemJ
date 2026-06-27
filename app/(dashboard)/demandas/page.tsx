import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GlobalKanbanBoard from '@/components/demandas/GlobalKanbanBoard'

export default async function DemandasPage() {
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar perfil do usuário logado
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  // Apenas gestores acessam essa página
  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  if (!isGestor) redirect('/semana')

  // Buscar todas as tarefas com projeto e cliente
  const { data: tarefas } = await supabase
    .from('tarefas')
    .select(`
      *,
      responsavel:profiles!responsavel_id(*),
      projeto:projetos(id, nome, cliente:clientes(id, nome))
    `)
    .order('ordem', { ascending: true })

  // Buscar todos os membros da equipe
  const { data: membros } = await supabase
    .from('profiles')
    .select('*')
    .order('nome')

  // Filtrar apenas designers gráficos
  const designers = (membros || []).filter((m: any) => m.role === 'design_grafico')
  const designerIds = designers.map((d: any) => d.id)

  // Filtrar tarefas pertencentes ao design (ou sem responsável atribuído)
  const tarefasDesign = (tarefas || []).filter((t: any) => {
    const ids = t.responsavel_ids || (t.responsavel_id ? [t.responsavel_id] : [])
    if (ids.length === 0) return true // Traz demandas sem responsável para que o gestor possa atribuir a um designer
    return ids.some(id => designerIds.includes(id))
  })

  // Buscar todos os projetos (operacionais) com cliente
  const { data: projetos } = await supabase
    .from('projetos')
    .select('*, cliente:clientes(nome)')
    .order('nome')

  return (
    <div className="space-y-6 animate-fade-in">
      <GlobalKanbanBoard
        tarefasIniciais={tarefasDesign}
        membros={designers}
        projetos={projetos || []}
        currentUserId={user.id}
      />
    </div>
  )
}
