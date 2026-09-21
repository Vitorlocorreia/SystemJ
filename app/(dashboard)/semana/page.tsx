import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeeklyPlanner from '@/components/semana/WeeklyPlanner'

// Sempre busca dados frescos do servidor — sem cache stale
export const revalidate = 0

export default async function SemanaPage() {
  const supabase = (await createClient()) as any

  // Verificar se o usuário está logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar apenas demandas de visitas/captações da agenda da semana (postagens de redes sociais ficam exclusivamente na mesa do cliente)
  const { data: tarefas } = await supabase
    .from('tarefas')
    .select('*, responsavel:profiles(*), projeto:projetos(id, nome, cliente:clientes(id, nome))')
    .or('tipo_demanda.eq.visita,tipo_demanda.is.null')
    .order('ordem')

  // Garantir filtragem estrita em memória: remover qualquer postagem/vídeo de rede social
  const visitasDaSemana = (tarefas as any[] || []).filter(
    (t: any) => t.tipo_demanda !== 'postagem' && !t.formato_video && !t.plataforma_programada
  )

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

  // Buscar perfil do usuário logado para saber role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  const isDesign = profile?.role === 'design_grafico'

  // Designers permanecem em /design, mas podem criar demandas pela agenda semanal se chegarem aqui
  if (isDesign) redirect('/design')

  return (
    <div className="space-y-6 animate-fade-in">
      <WeeklyPlanner
        tarefasIniciais={visitasDaSemana}
        membros={membros || []}
        clientes={clientes || []}
        currentUserId={user.id}
        isGestor={isGestor}
      />
    </div>
  )
}
