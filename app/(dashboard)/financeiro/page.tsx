import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FinanceiroClientView from '@/components/financeiro/FinanceiroClientView'
import type { Lancamento, CategoriaFinanceiro, Cliente, Projeto } from '@/types'

export const revalidate = 0

export default async function FinanceiroPage() {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  if (profile?.role === 'design_grafico') redirect('/design')
  if (!isGestor) redirect('/semana')

  // Buscar todos os dados financeiros em paralelo
  const [
    { data: lancamentos },
    { data: categorias },
    { data: clientes },
    { data: projetos }
  ] = await Promise.all([
    supabase
      .from('lancamentos')
      .select('*, categoria:categorias_financeiro(nome, cor), cliente:clientes(id, nome, empresa), projeto:projetos(id, nome, empresa)')
      .order('data_lancamento', { ascending: false }),
    supabase
      .from('categorias_financeiro')
      .select('*')
      .order('tipo')
      .order('nome'),
    supabase
      .from('clientes')
      .select('id, nome, cnpj_cpf, email, telefone, segmento, status, valor_contrato, empresa, created_at')
      .order('nome'),
    supabase
      .from('projetos')
      .select('id, nome, cliente_id, responsavel_id, status, prazo, descricao, empresa, created_at')
      .order('nome')
  ])

  return (
    <div className="space-y-6">
      {/* Header do Módulo */}
      <div>
        <h1 className="font-display text-2xl md:text-display-md text-text-primary">Financeiro Corporativo</h1>
        <p className="text-text-secondary text-sm mt-1">
          Gestão de fluxo de caixa, contratos de clientes, centros de custo e projeções financeiras do Grupo Jota.
        </p>
      </div>

      <FinanceiroClientView
        lancamentosIniciais={(lancamentos as Lancamento[]) || []}
        categoriasIniciais={(categorias as CategoriaFinanceiro[]) || []}
        clientesIniciais={(clientes as Cliente[]) || []}
        projetosIniciais={(projetos as Projeto[]) || []}
        currentUserId={user.id}
      />
    </div>
  )
}
