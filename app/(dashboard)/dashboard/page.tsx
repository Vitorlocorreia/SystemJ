import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import {
  Users,
  FolderKanban,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = (await createClient()) as any

  // Verificar autenticação e papel do usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  const isDesign = profile?.role === 'design_grafico'
  
  if (isDesign) redirect('/design')
  if (!isGestor) redirect('/semana')


  // Fetch KPI data in parallel
  const [
    { count: totalClientes },
    { count: clientesAtivos },
    { count: totalProjetos },
    { count: projetosAtivos },
    { count: tarefasPendentes },
    { data: lancamentosDoMes },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('projetos').select('*', { count: 'exact', head: true }),
    supabase.from('projetos').select('*', { count: 'exact', head: true }).in('status', ['planejamento', 'em_andamento']),
    supabase.from('tarefas').select('*', { count: 'exact', head: true }).in('status', ['a_fazer', 'em_andamento']),
    supabase.from('lancamentos').select('tipo, valor').gte('data_lancamento', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
  ])

  const receitas = lancamentosDoMes?.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0) ?? 0
  const despesas = lancamentosDoMes?.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0) ?? 0
  const margem = receitas - despesas

  const kpis = [
    {
      label: 'Clientes Ativos',
      value: clientesAtivos ?? 0,
      sub: `${totalClientes ?? 0} total`,
      icon: Users,
      gold: false,
    },
    {
      label: 'Projetos em Andamento',
      value: projetosAtivos ?? 0,
      sub: `${totalProjetos ?? 0} projetos`,
      icon: FolderKanban,
      gold: false,
    },
    {
      label: 'Tarefas Pendentes',
      value: tarefasPendentes ?? 0,
      sub: 'em aberto',
      icon: Clock,
      gold: false,
    },
    {
      label: 'Margem do Mês',
      value: formatCurrency(margem),
      sub: `R$ ${formatCurrency(receitas)} receitas`,
      icon: margem >= 0 ? TrendingUp : TrendingDown,
      gold: true,
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-display-md text-text-primary">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">
          Visão geral da operação — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, gold }) => (
          <div
            key={label}
            className={`card group hover:border-gold/30 transition-all duration-200 ${gold ? 'border-gold/20 shadow-gold-glow' : ''}`}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">{label}</p>
              <div className={`p-1.5 rounded ${gold ? 'bg-gold-muted' : 'bg-surface-elevated'}`}>
                <Icon size={14} className={gold ? 'text-gold' : 'text-text-secondary'} />
              </div>
            </div>
            <p className={`font-display tabular-nums leading-none ${gold ? 'text-gold text-3xl font-bold' : 'text-text-primary text-3xl font-bold'}`}>
              {value}
            </p>
            <p className="text-text-secondary text-xs mt-2">{sub}</p>
          </div>
        ))}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-display text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Financeiro do Mês
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2.5 border-b border-border">
              <span className="text-sm text-text-secondary">Receitas</span>
              <span className="font-display font-semibold text-success tabular-nums">{formatCurrency(receitas)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-border">
              <span className="text-sm text-text-secondary">Despesas</span>
              <span className="font-display font-semibold text-danger tabular-nums">{formatCurrency(despesas)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-sm font-medium text-text-primary">Margem líquida</span>
              <span className={`font-display font-bold tabular-nums ${margem >= 0 ? 'text-gold' : 'text-danger'}`}>
                {formatCurrency(margem)}
              </span>
            </div>
          </div>
        </div>

        <div className="card flex items-center justify-center">
          <div className="text-center text-text-secondary">
            <FolderKanban size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Gráfico de fluxo de caixa</p>
            <p className="text-xs mt-1 opacity-60">disponível no módulo Financeiro</p>
          </div>
        </div>
      </div>
    </div>
  )
}
