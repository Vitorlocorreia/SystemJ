import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GlobalKanbanBoard from '@/components/demandas/GlobalKanbanBoard'
import { isMolaProfile } from '@/lib/utils'

export const revalidate = 0

export default async function DemandasPage() {
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar perfil completo do usuário logado
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (profile?.role === 'design_grafico') {
    redirect('/design')
  }

  // Buscar todas as tarefas com projeto e cliente
  const { data: tarefas } = await supabase
    .from('tarefas')
    .select(`
      *,
      responsavel:profiles!responsavel_id(*),
      projeto:projetos(id, nome, empresa, cliente:clientes(id, nome, empresa))
    `)
    .order('ordem', { ascending: true })

  // Buscar todos os membros da equipe
  const { data: membros } = await supabase
    .from('profiles')
    .select('*')
    .order('nome')

  const isMola = isMolaProfile(profile)
  const tarefasFiltradas = isMola
    ? (tarefas || []).filter((t: any) => {
        const emp = t.projeto?.empresa || t.projeto?.cliente?.empresa || 'jota_esportivo'
        return emp === 'jota_esportivo'
      })
    : (tarefas || [])

  // Buscar todos os projetos (operacionais) com cliente
  const { data: projetos } = await supabase
    .from('projetos')
    .select('*, cliente:clientes(id, nome, empresa)')
    .order('nome')

  const projetosFiltrados = isMola
    ? (projetos || []).filter((p: any) => (p.empresa || p.cliente?.empresa || 'jota_esportivo') === 'jota_esportivo')
    : (projetos || [])

  return (
    <div className="space-y-6 animate-fade-in">
      <GlobalKanbanBoard
        tarefasIniciais={tarefasFiltradas}
        membros={membros || []}
        todosMembros={membros || []}
        currentUserProfile={profile}
        projetos={projetosFiltrados}
        currentUserId={user.id}
      />
    </div>
  )
}
