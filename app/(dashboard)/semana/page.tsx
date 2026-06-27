import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeeklyPlanner from '@/components/semana/WeeklyPlanner'

export default async function SemanaPage() {
  const supabase = (await createClient()) as any

  // Verificar se o usuário está logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar todas as tarefas, incluindo projeto e cliente
  const { data: tarefas } = await supabase
    .from('tarefas')
    .select('*, responsavel:profiles(*), projeto:projetos(id, nome, cliente:clientes(id, nome))')
    .order('ordem')

  // Buscar todos os perfis (membros da equipe)
  const { data: membros } = await supabase
    .from('profiles')
    .select('*')
    .order('nome')

  // Buscar todos os clientes
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome, status')
    .order('nome')

  // Buscar perfil do usuário logado para saber se é gestor
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  const isDesign = profile?.role === 'design_grafico'

  if (isDesign) redirect('/design')

  return (
    <div className="space-y-6 animate-fade-in">
      <WeeklyPlanner
        tarefasIniciais={tarefas || []}
        membros={membros || []}
        clientes={clientes || []}
        currentUserId={user.id}
        isGestor={isGestor}
      />
    </div>
  )
}
