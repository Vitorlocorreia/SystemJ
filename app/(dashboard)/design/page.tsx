import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DesignBoard from '@/components/demandas/DesignBoard'

export default async function DesignPage() {
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar perfil do usuário logado
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Apenas design_grafico acessa essa página
  if (!profile || profile.role !== 'design_grafico') redirect('/semana')

  // Buscar tarefas atribuídas ao designer (via responsavel_ids ou responsavel_id)
  const { data: todasTarefas } = await supabase
    .from('tarefas')
    .select(`
      *,
      responsavel:profiles!responsavel_id(*),
      projeto:projetos(id, nome, cliente:clientes(id, nome))
    `)
    .order('ordem', { ascending: true })

  // Filtrar tarefas onde o designer é responsável
  const tarefas = (todasTarefas || []).filter((t: any) => {
    const ids = t.responsavel_ids || (t.responsavel_id ? [t.responsavel_id] : [])
    return ids.includes(profile.id)
  })

  // Buscar todos os membros da equipe
  const { data: membros } = await supabase
    .from('profiles')
    .select('*')
    .order('nome')

  // Buscar projetos vinculados às tarefas do designer
  const projetoIds = [...new Set(tarefas.map((t: any) => t.projeto_id).filter(Boolean))]
  const { data: projetos } = await supabase
    .from('projetos')
    .select('id, nome, cliente:clientes(nome)')
    .in('id', projetoIds.length > 0 ? projetoIds : ['00000000-0000-0000-0000-000000000000'])

  return (
    <div className="space-y-6 animate-fade-in">
      <DesignBoard
        tarefasIniciais={tarefas}
        membros={membros || []}
        projetos={projetos || []}
        currentUserId={user.id}
      />
    </div>
  )
}
