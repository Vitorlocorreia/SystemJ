import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency, isMolaProfile } from '@/lib/utils'
import {
  Users,
  FolderKanban,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Bell,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = (await createClient()) as any

  // Verificar autenticação e papel do usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nome')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'owner' || profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro' || (profile?.nome?.toLowerCase()?.includes('mola') || profile?.nome?.toLowerCase()?.includes('rennan') || profile?.nome?.toLowerCase()?.includes('renan'))
  const isDesign = profile?.role === 'design_grafico'
  
  if (isDesign) redirect('/design')
  if (!isGestor) redirect('/semana')


  const isMola = isMolaProfile(profile)

  // Fetch KPI data in parallel (filtrando Jota Esportivo para Mola)
  const [
    { count: totalClientes },
    { count: clientesAtivos },
    { count: totalProjetos },
    { count: projetosAtivos },
    { count: tarefasPendentes },
    { data: lancamentosDoMes },
    { data: lancamentosPendentes },
    { data: cobrancasPendentes },
  ] = await Promise.all([
    isMola
      ? supabase.from('clientes').select('*', { count: 'exact', head: true }).or('empresa.eq.jota_esportivo,empresa.is.null')
      : supabase.from('clientes').select('*', { count: 'exact', head: true }),
    isMola
      ? supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('status', 'ativo').or('empresa.eq.jota_esportivo,empresa.is.null')
      : supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    isMola
      ? supabase.from('projetos').select('*', { count: 'exact', head: true }).or('empresa.eq.jota_esportivo,empresa.is.null')
      : supabase.from('projetos').select('*', { count: 'exact', head: true }),
    isMola
      ? supabase.from('projetos').select('*', { count: 'exact', head: true }).in('status', ['planejamento', 'em_andamento']).or('empresa.eq.jota_esportivo,empresa.is.null')
      : supabase.from('projetos').select('*', { count: 'exact', head: true }).in('status', ['planejamento', 'em_andamento']),
    supabase.from('tarefas').select('*', { count: 'exact', head: true }).in('status', ['a_fazer', 'em_andamento']),
    isMola
      ? supabase.from('lancamentos').select('tipo, valor, empresa').gte('data_lancamento', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]).or('empresa.eq.jota_esportivo,empresa.is.null')
      : supabase.from('lancamentos').select('tipo, valor, empresa').gte('data_lancamento', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
    isMola
      ? supabase.from('lancamentos').select('id, tipo, descricao, valor, status, data_vencimento, data_lancamento, empresa').eq('status', 'pendente').or('empresa.eq.jota_esportivo,empresa.is.null')
      : supabase.from('lancamentos').select('id, tipo, descricao, valor, status, data_vencimento, data_lancamento, empresa').eq('status', 'pendente'),
    isMola
      ? supabase.from('cobrancas').select('id, valor_total, valor_pago, status, data_vencimento, empresa, cliente:clientes(nome, empresa)').neq('status', 'pago').or('empresa.eq.jota_esportivo,empresa.is.null')
      : supabase.from('cobrancas').select('id, valor_total, valor_pago, status, data_vencimento, empresa, cliente:clientes(nome, empresa)').neq('status', 'pago'),
  ])

  const receitas = lancamentosDoMes?.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0) ?? 0
  const despesas = lancamentosDoMes?.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0) ?? 0
  const margem = receitas - despesas

  const todayStr = new Date().toISOString().split('T')[0]
  const despesasPendentes = (lancamentosPendentes as any[])?.filter(l => l.tipo === 'despesa') || []
  const receitasPendentesLanc = (lancamentosPendentes as any[])?.filter(l => l.tipo === 'receita') || []
  
  const totalAPagarPend = despesasPendentes.reduce((s, l) => s + Number(l.valor || 0), 0)
  const totalAReceberLanc = receitasPendentesLanc.reduce((s, l) => s + Number(l.valor || 0), 0)
  const totalAReceberCobrancas = ((cobrancasPendentes as any[]) || []).reduce((s, c) => s + (Number(c.valor_total || 0) - Number(c.valor_pago || 0)), 0)
  const totalAReceberPend = totalAReceberLanc + totalAReceberCobrancas

  let qtdAtrasadas = 0
  let valorAtrasado = 0
  let qtdHoje = 0
  let valorHoje = 0

  despesasPendentes.forEach(d => {
    const venc = d.data_vencimento || d.data_lancamento
    const val = Number(d.valor || 0)
    if (venc < todayStr) {
      qtdAtrasadas++
      valorAtrasado += val
    } else if (venc === todayStr) {
      qtdHoje++
      valorHoje += val
    }
  })

  ;((cobrancasPendentes as any[]) || []).forEach(c => {
    const venc = c.data_vencimento
    const val = Number(c.valor_total || 0) - Number(c.valor_pago || 0)
    if (venc && venc < todayStr) {
      qtdAtrasadas++
      valorAtrasado += val
    } else if (venc && venc === todayStr) {
      qtdHoje++
      valorHoje += val
    }
  })

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
            <p className={`font-display tabular-nums leading-tight tracking-tight truncate max-w-full block ${gold ? 'text-gold text-xl sm:text-2xl lg:text-3xl font-bold' : 'text-text-primary text-xl sm:text-2xl lg:text-3xl font-bold'}`}>
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

        {/* Radar de Vencimentos (A Pagar & A Receber) */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Bell size={15} className="text-gold" />
              <span>Radar de Vencimentos</span>
            </h2>
            <Link
              href="/financeiro"
              className="text-xs text-gold hover:underline font-semibold flex items-center gap-1"
            >
              Abrir Financeiro &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {/* Status de Alerta Rápido */}
            {(qtdAtrasadas > 0 || qtdHoje > 0) ? (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <span className="text-text-primary font-medium">
                    {qtdAtrasadas > 0 ? `${qtdAtrasadas} conta(s) em atraso` : `${qtdHoje} conta(s) vencendo hoje`}
                  </span>
                </div>
                <span className="font-bold font-mono text-danger">
                  {formatCurrency(valorAtrasado > 0 ? valorAtrasado : valorHoje)}
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 size={15} />
                <span>Nenhum vencimento atrasado no momento.</span>
              </div>
            )}

            <div className="flex justify-between items-center py-2 border-b border-border text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <ArrowDownRight size={14} className="text-danger" />
                <span>Total a Pagar Pendente</span>
              </span>
              <span className="font-display font-semibold text-danger tabular-nums">
                {formatCurrency(totalAPagarPend)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <ArrowUpRight size={14} className="text-success" />
                <span>Total a Receber Pendente</span>
              </span>
              <span className="font-display font-semibold text-success tabular-nums">
                {formatCurrency(totalAReceberPend)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 text-xs">
              <span className="text-text-secondary font-medium">Previsão Líquida Pendente</span>
              <span className={`font-display font-bold tabular-nums ${totalAReceberPend >= totalAPagarPend ? 'text-gold' : 'text-danger'}`}>
                {formatCurrency(totalAReceberPend - totalAPagarPend)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
