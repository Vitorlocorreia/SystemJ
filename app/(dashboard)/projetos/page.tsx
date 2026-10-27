import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjetosKanban from '@/components/projetos/ProjetosKanban'
import { isMolaProfile } from '@/lib/utils'

export const metadata = { title: 'Projetos | Grupo Jota' }

export default async function ProjetosPage() {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Gestores, Design e Mola / Rennan
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nome')
    .eq('user_id', user.id)
    .single()

  const nomeLower = profile?.nome?.toLowerCase() || ''
  const isGestor = profile?.role === 'owner' || profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro' || (nomeLower.includes('mola') || nomeLower.includes('rennan') || nomeLower.includes('renan'))
  const isDesign = profile?.role === 'design_grafico'
  const isRennan = nomeLower.includes('rennan') || nomeLower.includes('renan')

  if (!isGestor && !isDesign && !isRennan) redirect('/semana')

  const [
    { data: projetos },
    { data: membros },
    { data: clientes },
  ] = await Promise.all([
    supabase
      .from('projetos_kanban')
      .select('*, cliente:clientes(id,nome,email,telefone,segmento,status,empresa,created_at), responsavel:profiles!responsavel_id(id,user_id,nome,cargo,role,avatar_url,created_at)')
      .order('ordem', { ascending: true }),
    supabase.from('profiles').select('*').order('nome'),
    supabase.from('clientes').select('id,nome,email,telefone,segmento,status,empresa,created_at').eq('status', 'ativo').order('nome'),
  ])

  const isMola = isMolaProfile(profile)
  const projetosVisiveis = isMola
    ? (projetos || []).filter((p: any) => (p.empresa || p.cliente?.empresa || 'jota_esportivo') === 'jota_esportivo')
    : (projetos || [])
  const clientesVisiveis = isMola
    ? (clientes || []).filter((c: any) => (c.empresa || 'jota_esportivo') === 'jota_esportivo')
    : (clientes || [])

  return (
    <ProjetosKanban
      projetosIniciais={projetosVisiveis}
      membros={membros || []}
      clientes={clientesVisiveis}
      currentUserId={user.id}
    />
  )
}
