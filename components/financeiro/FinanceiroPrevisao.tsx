'use client'

import { useMemo, useState } from 'react'
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Building2,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Target,
  Zap
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { Cliente, Lancamento, EmpresaGrupo } from '@/types'

interface FinanceiroPrevisaoProps {
  clientes: Cliente[]
  lancamentos: Lancamento[]
  filtroEmpresaGlobal: string
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function FinanceiroPrevisao({
  clientes,
  lancamentos,
  filtroEmpresaGlobal
}: FinanceiroPrevisaoProps) {
  const [cenario, setCenario] = useState<'conservador' | 'realista' | 'otimista'>('realista')

  // Clientes filtrados por empresa
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const emp = c.empresa || 'jota_esportivo'
      return filtroEmpresaGlobal === 'todos' || emp === filtroEmpresaGlobal
    })
  }, [clientes, filtroEmpresaGlobal])

  // Lançamentos filtrados por empresa
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      const emp = l.empresa || 'jota_esportivo'
      return filtroEmpresaGlobal === 'todos' || emp === filtroEmpresaGlobal
    })
  }, [lancamentos, filtroEmpresaGlobal])

  // Métricas do Motor de Previsão
  const forecastMetrics = useMemo(() => {
    // 1. Receita Recorrente dos Contratos Ativos (MRR)
    const mrrGarantido = clientesFiltrados
      .filter(c => c.status === 'ativo')
      .reduce((sum, c) => sum + (c.valor_contrato || 0), 0)

    // 2. Potencial de Prospectos
    const pipelineProspectos = clientesFiltrados
      .filter(c => c.status === 'prospecto')
      .reduce((sum, c) => sum + (c.valor_contrato || 0), 0)

    // 3. Média Histórica de Despesas Mensais (últimos 3 meses com lançamentos)
    const despesasTotais = lancamentosFiltrados
      .filter(l => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0)

    // Número de meses distintos com lançamentos ou mínimo 1
    const mesesComDados = new Set(
      lancamentosFiltrados.map(l => l.data_lancamento?.slice(0, 7)).filter(Boolean)
    ).size || 1

    const despesaMediaMensal = despesasTotais > 0 ? despesasTotais / mesesComDados : 12000

    // 4. Média Histórica de Receitas Extras (avulsas além do MRR)
    const receitasTotais = lancamentosFiltrados
      .filter(l => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0)
    
    const receitaMediaMensal = receitasTotais > 0 ? receitasTotais / mesesComDados : mrrGarantido
    const extraJobsMedio = Math.max(0, receitaMediaMensal - mrrGarantido)

    // Fatores de ajuste por cenário
    let fatorExtra = 0
    let fatorProspecto = 0

    if (cenario === 'conservador') {
      fatorExtra = 0 // Só o contrato garantido
      fatorProspecto = 0
    } else if (cenario === 'realista') {
      fatorExtra = extraJobsMedio // Contratos + média de produções extras
      fatorProspecto = pipelineProspectos * 0.25 // 25% de conversão de prospectos
    } else {
      fatorExtra = extraJobsMedio * 1.3 // 30% a mais de jobs
      fatorProspecto = pipelineProspectos * 0.6 // 60% de conversão
    }

    const receitaMensalProjetada = mrrGarantido + fatorExtra + fatorProspecto
    const lucroMensalProjetado = receitaMensalProjetada - despesaMediaMensal

    // Previsão 1 Mês (Próximo Mês)
    const prev1Mes = {
      receita: receitaMensalProjetada,
      despesa: despesaMediaMensal,
      lucro: lucroMensalProjetado,
      margem: receitaMensalProjetada > 0 ? (lucroMensalProjetado / receitaMensalProjetada) * 100 : 0
    }

    // Previsão 3 Meses (Trimestre)
    const prev3Meses = {
      receita: receitaMensalProjetada * 3,
      despesa: despesaMediaMensal * 3,
      lucro: lucroMensalProjetado * 3
    }

    // Previsão 6 Meses (Semestre)
    const prev6Meses = {
      receita: receitaMensalProjetada * 6,
      despesa: despesaMediaMensal * 6,
      lucro: lucroMensalProjetado * 6
    }

    return {
      mrrGarantido,
      pipelineProspectos,
      despesaMediaMensal,
      receitaMensalProjetada,
      prev1Mes,
      prev3Meses,
      prev6Meses
    }
  }, [clientesFiltrados, lancamentosFiltrados, cenario])

  // Série temporal para o Gráfico: 3 meses passados realizados + 4 meses futuros projetados
  const chartData = useMemo(() => {
    const data: any[] = []
    const now = new Date()

    // 3 meses passados
    for (let i = 3; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`

      const rec = lancamentosFiltrados
        .filter(l => l.tipo === 'receita' && l.data_lancamento?.startsWith(key))
        .reduce((sum, l) => sum + l.valor, 0)

      const desp = lancamentosFiltrados
        .filter(l => l.tipo === 'despesa' && l.data_lancamento?.startsWith(key))
        .reduce((sum, l) => sum + l.valor, 0)

      data.push({
        label,
        tipo: 'realizado',
        'Receita Realizada': rec || forecastMetrics.mrrGarantido,
        'Despesa Realizada': desp || forecastMetrics.despesaMediaMensal,
        'Lucro Realizado': (rec || forecastMetrics.mrrGarantido) - (desp || forecastMetrics.despesaMediaMensal),
      })
    }

    // Mês Atual (híbrido)
    const currentMonthLabel = `${MONTH_NAMES[now.getMonth()]}/${String(now.getFullYear()).slice(-2)} (Atual)`
    data.push({
      label: currentMonthLabel,
      tipo: 'atual',
      'Receita Realizada': forecastMetrics.mrrGarantido,
      'Despesa Realizada': forecastMetrics.despesaMediaMensal,
      'Lucro Realizado': forecastMetrics.mrrGarantido - forecastMetrics.despesaMediaMensal,
    })

    // 3 meses futuros projetados
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const label = `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)} (Prev)`

      data.push({
        label,
        tipo: 'projetado',
        'Receita Projetada': forecastMetrics.receitaMensalProjetada,
        'Despesa Projetada': forecastMetrics.despesaMediaMensal,
        'Lucro Projetado': forecastMetrics.prev1Mes.lucro,
      })
    }

    return data
  }, [lancamentosFiltrados, forecastMetrics])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-border p-3 rounded-lg shadow-xl text-xs space-y-1.5">
          <p className="font-bold text-text-primary border-b border-border pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-bold text-text-primary tabular-nums">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra Superior de Cenários de Previsão */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface border border-border p-4 rounded-xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-gold-muted text-gold border border-gold/20">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">Motor de Previsão & Projeção Financeira</h3>
            <p className="text-xs text-text-secondary">Simulação de receitas, despesas e lucro futuro para o Grupo Jota</p>
          </div>
        </div>

        {/* Seletor de Cenário */}
        <div className="flex items-center p-1 bg-surface-elevated rounded-lg border border-border">
          <button
            onClick={() => setCenario('conservador')}
            className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              cenario === 'conservador'
                ? 'bg-surface text-text-primary shadow-sm border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <ShieldCheck size={13} className="text-text-secondary" />
            <span>Conservador</span>
          </button>
          <button
            onClick={() => setCenario('realista')}
            className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              cenario === 'realista'
                ? 'bg-gold-muted text-gold shadow-gold-glow border border-gold/30 font-bold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Target size={13} className="text-gold" />
            <span>Realista (Recomendado)</span>
          </button>
          <button
            onClick={() => setCenario('otimista')}
            className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              cenario === 'otimista'
                ? 'bg-success/20 text-success shadow-sm border border-success/30 font-bold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Zap size={13} className="text-success" />
            <span>Otimista (+Prospectos)</span>
          </button>
        </div>
      </div>

      {/* Cards de Previsão: Próximo Mês, 3 Meses e 6 Meses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Ativo Garantido */}
        <div className="card border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">MRR Contratado Base</span>
            <Building2 size={16} className="text-text-secondary" />
          </div>
          <p className="kpi-number text-text-primary mt-2">{formatCurrency(forecastMetrics.mrrGarantido)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Garantido por clientes ativos da Jota</p>
        </div>

        {/* Previsão Próximo Mês */}
        <div className="card border-gold/30 shadow-gold-glow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Lucro Previsto (Próximo Mês)</span>
            <ArrowUpRight size={16} className="text-gold" />
          </div>
          <p className={`kpi-number mt-2 ${forecastMetrics.prev1Mes.lucro >= 0 ? 'text-gold' : 'text-danger'}`}>
            {formatCurrency(forecastMetrics.prev1Mes.lucro)}
          </p>
          <div className="flex items-center justify-between text-[10px] text-text-secondary mt-1 pt-1 border-t border-border/50">
            <span>Rec: {formatCurrency(forecastMetrics.prev1Mes.receita)}</span>
            <span>Desp: {formatCurrency(forecastMetrics.prev1Mes.despesa)}</span>
          </div>
        </div>

        {/* Previsão 3 Meses */}
        <div className="card border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Lucro Previsto (3 Meses)</span>
            <Calendar size={16} className="text-cyan-400" />
          </div>
          <p className={`kpi-number mt-2 ${forecastMetrics.prev3Meses.lucro >= 0 ? 'text-cyan-400' : 'text-danger'}`}>
            {formatCurrency(forecastMetrics.prev3Meses.lucro)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            Faturamento trimestral: {formatCurrency(forecastMetrics.prev3Meses.receita)}
          </p>
        </div>

        {/* Previsão 6 Meses */}
        <div className="card border-purple-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Lucro Previsto (6 Meses)</span>
            <TrendingUp size={16} className="text-purple-400" />
          </div>
          <p className={`kpi-number mt-2 ${forecastMetrics.prev6Meses.lucro >= 0 ? 'text-purple-400' : 'text-danger'}`}>
            {formatCurrency(forecastMetrics.prev6Meses.lucro)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            Faturamento semestral: {formatCurrency(forecastMetrics.prev6Meses.receita)}
          </p>
        </div>
      </div>

      {/* Gráfico Visual de Projeção */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">Curva de Forecast & Tendência de Lucro</h3>
            <p className="text-xs text-text-secondary">Comparação dos meses realizados com a projeção futura para os próximos 90 dias</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Realizado</span>
            </span>
            <span className="flex items-center gap-1.5 text-gold font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
              <span>Projeção Futura</span>
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }} />
              
              {/* Barras do Realizado */}
              <Bar dataKey="Receita Realizada" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="Despesa Realizada" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={30} />

              {/* Linhas de Projeção */}
              <Line type="monotone" dataKey="Receita Projetada" stroke="#C9A84C" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4, fill: '#C9A84C' }} />
              <Line type="monotone" dataKey="Despesa Projetada" stroke="#F87171" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3, fill: '#F87171' }} />
              <Line type="monotone" dataKey="Lucro Projetado" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 4, fill: '#06B6D4' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de Detalhamento da Previsão */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface-elevated flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-text-primary">Quadro Resumo de Planejamento Financeiro</h3>
          <span className="text-xs text-text-secondary capitalize">Cenário {cenario} ativo</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase">Horizonte</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase">Receita Estimada</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase">Custos Estimados</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase">Lucro Projetado</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase">Margem Operacional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-surface-elevated/40">
                <td className="px-5 py-4 font-bold text-text-primary">1 Mês (Próximo Mês)</td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-success font-semibold">
                  {formatCurrency(forecastMetrics.prev1Mes.receita)}
                </td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-danger font-semibold">
                  {formatCurrency(forecastMetrics.prev1Mes.despesa)}
                </td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-gold font-bold text-sm">
                  {formatCurrency(forecastMetrics.prev1Mes.lucro)}
                </td>
                <td className="px-5 py-4 text-right font-mono font-bold text-text-primary">
                  {forecastMetrics.prev1Mes.margem.toFixed(1)}%
                </td>
              </tr>
              <tr className="hover:bg-surface-elevated/40">
                <td className="px-5 py-4 font-bold text-text-primary">3 Meses (Trimestre)</td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-success font-semibold">
                  {formatCurrency(forecastMetrics.prev3Meses.receita)}
                </td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-danger font-semibold">
                  {formatCurrency(forecastMetrics.prev3Meses.despesa)}
                </td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-cyan-400 font-bold text-sm">
                  {formatCurrency(forecastMetrics.prev3Meses.lucro)}
                </td>
                <td className="px-5 py-4 text-right font-mono font-bold text-text-primary">
                  {forecastMetrics.prev1Mes.margem.toFixed(1)}%
                </td>
              </tr>
              <tr className="hover:bg-surface-elevated/40">
                <td className="px-5 py-4 font-bold text-text-primary">6 Meses (Semestre)</td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-success font-semibold">
                  {formatCurrency(forecastMetrics.prev6Meses.receita)}
                </td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-danger font-semibold">
                  {formatCurrency(forecastMetrics.prev6Meses.despesa)}
                </td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-purple-400 font-bold text-sm">
                  {formatCurrency(forecastMetrics.prev6Meses.lucro)}
                </td>
                <td className="px-5 py-4 text-right font-mono font-bold text-text-primary">
                  {forecastMetrics.prev1Mes.margem.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
