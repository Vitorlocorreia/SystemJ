import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FinanceiroClientView from '@/components/financeiro/FinanceiroClientView'
import type { Lancamento, CategoriaFinanceiro, Cliente, Projeto, Cobranca } from '@/types'
import { isMolaProfile } from '@/lib/utils'

export const revalidate = 0

export default async function FinanceiroPage() {
  const supabase = (await createClient()) as any
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

  const isMola = isMolaProfile(profile)

  // Buscar todos os dados financeiros em paralelo
  let [
    { data: lancamentos },
    { data: categorias },
    { data: clientes },
    { data: projetos },
    { data: cobrancas }
  ] = await Promise.all([
    supabase
      .from('lancamentos')
      .select('*, categoria:categorias_financeiro(nome, cor), cliente:clientes(id, nome, empresa), projeto:projetos(id, nome, empresa)')
      .order('data_lancamento', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('categorias_financeiro')
      .select('*')
      .order('tipo')
      .order('nome'),
    supabase
      .from('clientes')
      .select('id, nome, cnpj_cpf, email, telefone, segmento, status, valor_contrato, data_inicio_contrato, data_fim_contrato, dia_vencimento, forma_pagamento, empresa, created_at')
      .order('nome'),
    supabase
      .from('projetos')
      .select('id, nome, cliente_id, responsavel_id, status, prazo, descricao, empresa, created_at')
      .order('nome'),
    supabase
      .from('cobrancas')
      .select('*, cliente:clientes(id, nome, empresa, valor_contrato, data_inicio_contrato, data_fim_contrato, dia_vencimento)')
      .order('data_vencimento', { ascending: false })
  ])

  // Se for o Mola, filtrar estritamente para dados exclusivos da empresa Jota Esportivo
  if (isMola) {
    lancamentos = (lancamentos as any[] || []).filter(l => (l.empresa || 'jota_esportivo') === 'jota_esportivo')
    clientes = (clientes as any[] || []).filter(c => (c.empresa || 'jota_esportivo') === 'jota_esportivo')
    projetos = (projetos as any[] || []).filter(p => (p.empresa || 'jota_esportivo') === 'jota_esportivo')
    cobrancas = (cobrancas as any[] || []).filter(cb => (cb.cliente?.empresa || 'jota_esportivo') === 'jota_esportivo')
  }

  return (
    <div className="space-y-6">
      {/* Header do Módulo */}
      <div>
        <h1 className="font-display text-2xl md:text-display-md text-text-primary">Financeiro Corporativo</h1>
        <p className="text-text-secondary text-sm mt-1">
          {isMola
            ? 'Visualização de fluxo de caixa, contratos e movimentações exclusivamente do Jota Esportivo.'
            : 'Gestão de fluxo de caixa, contratos de clientes, centros de custo e projeções financeiras do Grupo Jota.'}
        </p>
      </div>

      <FinanceiroClientView
        lancamentosIniciais={(lancamentos as Lancamento[]) || []}
        categoriasIniciais={(categorias as CategoriaFinanceiro[]) || []}
        clientesIniciais={(clientes as Cliente[]) || []}
        projetosIniciais={(projetos as Projeto[]) || []}
        cobrancasIniciais={(cobrancas as Cobranca[]) || []}
        currentUserId={profile?.id || user.id}
        isVisualizador={isMola}
        onlyEmpresa={isMola ? 'jota_esportivo' : undefined}
      />
    </div>
  )
}
