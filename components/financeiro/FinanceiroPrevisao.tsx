'use client'

import { useMemo, useState } from 'react'
import {
  Calendar,
  DollarSign,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Users,
  ChevronRight,
  HelpCircle,
  FileCheck
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
const FULL_MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function FinanceiroPrevisao({
  clientes,
  lancamentos,
  filtroEmpresaGlobal
}: FinanceiroPrevisaoProps) {
  const [horizonteMeses, setHorizonteMeses] = useState<3 | 6 | 12>(6)
  const [mesSelecionadoDetalhe, setMesSelecionadoDetalhe] = useState<number>(1) // 1 = próximo mês

  // Clientes filtrados pela empresa global
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const emp = c.empresa || 'jota_esportivo'
      return filtroEmpresaGlobal === 'todos' || emp === filtroEmpresaGlobal
    })
  }, [clientes, filtroEmpresaGlobal])

  // Lançamentos filtrados pela empresa global
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      const emp = l.empresa || 'jota_esportivo'
      return filtroEmpresaGlobal === 'todos' || emp === filtroEmpresaGlobal
    })
  }, [lancamentos, filtroEmpresaGlobal])

  // Base de Despesas Recorrentes / Fixas Mensais
  const despesaFixaMensal = useMemo(() => {
    // 1. Somar despesas marcadas explicitamente como recorrentes
    const recorrentes = lancamentosFiltrados
      .filter(l => l.tipo === 'despesa' && l.is_recorrente)
      .reduce((sum, l) => sum + l.valor, 0)

    if (recorrentes > 0) return recorrentes

    // 2. Se não houver marcadas ainda, calcular a média real dos meses com lançamentos
    const totalDespesas = lancamentosFiltrados
      .filter(l => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0)

    const mesesDistintos = new Set(
      lancamentosFiltrados
        .filter(l => l.tipo === 'despesa')
        .map(l => l.data_lancamento?.slice(0, 7))
        .filter(Boolean)
    ).size || 1

    return totalDespesas > 0 ? totalDespesas / mesesDistintos : 8500
  }, [lancamentosFiltrados])

  // Cálculo Determinístico Mês a Mês baseado estritamente na Vigência dos Contratos
  const projecaoMeses = useMemo(() => {
    const meses = []
    const now = new Date()

    for (let i = 0; i <= horizonteMeses; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const targetYear = targetDate.getFullYear()
      const targetMonth = targetDate.getMonth()

      const inicioDoMesStr = new Date(targetYear, targetMonth, 1).toISOString().slice(0, 10)
      const fimDoMesStr = new Date(targetYear, targetMonth + 1, 0).toISOString().slice(0, 10)
      const mesChave = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`

      // 1. Contratos Ativos que estão VIGENTES neste mês específico
      const contratosVigentes = clientesFiltrados.filter(c => {
        if (c.status !== 'ativo' || !c.valor_contrato || c.valor_contrato <= 0) return false

        // Não iniciou ainda
        if (c.data_inicio_contrato && c.data_inicio_contrato > fimDoMesStr) return false

        // Já encerrou antes deste mês
        if (c.data_fim_contrato && c.data_fim_contrato < inicioDoMesStr) return false

        return true
      })

      // Receita Contratada Real Garantida
      const receitaContratada = contratosVigentes.reduce((sum, c) => sum + (c.valor_contrato || 0), 0)

      // 2. Contratos que ACABAM / EXPIRAM exatamente neste mês
      const contratosExpirandoNoMes = contratosVigentes.filter(c => {
        if (!c.data_fim_contrato) return false
        return c.data_fim_contrato >= inicioDoMesStr && c.data_fim_contrato <= fimDoMesStr
      })

      const valorEmRiscoExpiracao = contratosExpirandoNoMes.reduce(
        (sum, c) => sum + (c.valor_contrato || 0),
        0
      )

      // 3. Despesas Fixas + Despesas agendadas no caixa para este mês futuro
      const despesasAgendadasNoMes = lancamentosFiltrados
        .filter(l => l.tipo === 'despesa' && l.data_lancamento?.startsWith(mesChave))
        .reduce((sum, l) => sum + l.valor, 0)

      const despesaTotalProjetada = Math.max(despesaFixaMensal, despesasAgendadasNoMes)
      const lucroLiquidoProjetado = receitaContratada - despesaTotalProjetada
      const margemOperacional = receitaContratada > 0 ? (lucroLiquidoProjetado / receitaContratada) * 100 : 0

      meses.push({
        index: i,
        isAtual: i === 0,
        labelCurto: `${MONTH_NAMES[targetMonth]}/${String(targetYear).slice(-2)}`,
        labelCompleto: `${FULL_MONTH_NAMES[targetMonth]} de ${targetYear}`,
        mesChave,
        contratosVigentes,
        contratosExpirandoNoMes,
        valorEmRiscoExpiracao,
        receitaContratada,
        despesaTotalProjetada,
        lucroLiquidoProjetado,
        margemOperacional
      })
    }

    return meses
  }, [clientesFiltrados, lancamentosFiltrados, horizonteMeses, despesaFixaMensal])

  // Detalhe do mês em foco
  const mesEmFoco = useMemo(() => {
    return projecaoMeses[mesSelecionadoDetalhe] || projecaoMeses[1] || projecaoMeses[0]
  }, [projecaoMeses, mesSelecionadoDetalhe])

  // Dados para o Gráfico Recharts
  const chartData = useMemo(() => {
    return projecaoMeses.map(m => ({
      label: m.isAtual ? `${m.labelCurto} (Atual)` : m.labelCurto,
      'Receita Contratada': m.receitaContratada,
      'Custos Fixos': m.despesaTotalProjetada,
      'Lucro Projetado': m.lucroLiquidoProjetado
    }))
  }, [projecaoMeses])

  const mesAtual = projecaoMeses[0]
  const proximoMes = projecaoMeses[1]
  const em3Meses = projecaoMeses[3] || projecaoMeses[projecaoMeses.length - 1]
  const em6Meses = projecaoMeses[6] || projecaoMeses[projecaoMeses.length - 1]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-border p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[200px]">
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
      {/* Header Informativo da Previsão Baseada em Contratos */}
      <div className="bg-surface border border-border p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-text-primary">
                Previsão Financeira Determinística por Contratos
              </h3>
              <span className="badge border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                100% Baseado em Vigência Real
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Cálculo exato da receita mês a mês considerando as datas de início e término de cada cliente assinado.
            </p>
          </div>
        </div>

        {/* Seletor de Horizonte Temporal */}
        <div className="flex items-center p-1 bg-surface-elevated rounded-lg border border-border text-xs">
          <button
            onClick={() => setHorizonteMeses(3)}
            className={`py-1.5 px-3 rounded font-semibold transition-all ${
              horizonteMeses === 3 ? 'bg-gold text-black font-bold shadow-gold-glow' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            3 Meses
          </button>
          <button
            onClick={() => setHorizonteMeses(6)}
            className={`py-1.5 px-3 rounded font-semibold transition-all ${
              horizonteMeses === 6 ? 'bg-gold text-black font-bold shadow-gold-glow' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            6 Meses (Padrão)
          </button>
          <button
            onClick={() => setHorizonteMeses(12)}
            className={`py-1.5 px-3 rounded font-semibold transition-all ${
              horizonteMeses === 12 ? 'bg-gold text-black font-bold shadow-gold-glow' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            12 Meses (Anual)
          </button>
        </div>
      </div>

      {/* Cards de Comparativo Temporal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mês Atual (Base) */}
        <div className="card border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              {mesAtual?.labelCompleto} (Atual)
            </span>
            <Building2 size={16} className="text-text-secondary" />
          </div>
          <p className="kpi-number text-text-primary mt-2">{formatCurrency(mesAtual?.receitaContratada || 0)}</p>
          <p className="text-[10px] text-text-secondary mt-1">
            {mesAtual?.contratosVigentes.length} contratos ativos no mês
          </p>
        </div>

        {/* Próximo Mês */}
        <div className="card border-gold/30 shadow-gold-glow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gold uppercase tracking-wider">
              {proximoMes?.labelCompleto} (+1 Mês)
            </span>
            <ArrowUpRight size={16} className="text-gold" />
          </div>
          <p className="kpi-number text-gold mt-2">{formatCurrency(proximoMes?.receitaContratada || 0)}</p>
          <div className="flex items-center justify-between text-[10px] text-text-secondary mt-1 pt-1 border-t border-border/50">
            <span>Lucro Líquido: {formatCurrency(proximoMes?.lucroLiquidoProjetado || 0)}</span>
            <span className="text-success font-bold">{proximoMes?.margemOperacional.toFixed(0)}% margem</span>
          </div>
        </div>

        {/* Em 3 Meses */}
        <div className="card border-cyan-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              {em3Meses?.labelCompleto} (+3 Meses)
            </span>
            <Calendar size={16} className="text-cyan-400" />
          </div>
          <p className="kpi-number text-cyan-400 mt-2">{formatCurrency(em3Meses?.receitaContratada || 0)}</p>
          <p className="text-[10px] text-text-secondary mt-1">
            Lucro Previsto: {formatCurrency(em3Meses?.lucroLiquidoProjetado || 0)}
          </p>
        </div>

        {/* Em 6 Meses */}
        <div className="card border-purple-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
              {em6Meses?.labelCompleto} (+6 Meses)
            </span>
            <ShieldCheck size={16} className="text-purple-400" />
          </div>
          <p className="kpi-number text-purple-400 mt-2">{formatCurrency(em6Meses?.receitaContratada || 0)}</p>
          <p className="text-[10px] text-text-secondary mt-1">
            {em6Meses?.contratosVigentes.length} contratos com vigência até este mês
          </p>
        </div>
      </div>

      {/* Gráfico da Curva Contratual Real */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">
              Curva de Receita Contratual Garantida vs Custos Fixos
            </h3>
            <p className="text-xs text-text-secondary">
              A curva reflete a saída real de contratos que possuem data de encerramento programada
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-gold font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-gold" />
              <span>Receita Contratada</span>
            </span>
            <span className="flex items-center gap-1.5 text-red-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span>Custos Fixos</span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>Lucro Líquido</span>
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
              
              <Bar dataKey="Receita Contratada" fill="#C9A84C" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Custos Fixos" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Line type="monotone" dataKey="Lucro Projetado" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 4, fill: '#06B6D4' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de Planejamento Mês a Mês com Destaque de Vencimento de Contratos */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface-elevated flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">
              Detalhamento Mês a Mês & Contratos Expirando
            </h3>
            <p className="text-xs text-text-secondary">
              Acompanhe quais clientes encerram contrato em cada mês para agir na renovação
            </p>
          </div>
          <span className="text-xs text-text-secondary">
            Clique na linha para inspecionar os contratos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase">Mês de Referência</th>
                <th className="text-center px-5 py-3.5 text-text-secondary font-medium uppercase">Contratos Vigentes</th>
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase">Contratos que Encerram no Mês</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase">Receita Contratada</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase">Custos Fixos</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase">Lucro Projetado</th>
                <th className="text-center px-5 py-3.5 text-text-secondary font-medium uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projecaoMeses.map(m => {
                const isSelected = mesSelecionadoDetalhe === m.index

                return (
                  <tr
                    key={m.index}
                    onClick={() => setMesSelecionadoDetalhe(m.index)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-surface-elevated border-l-2 border-gold' : 'hover:bg-surface-elevated/40'
                    }`}
                  >
                    {/* Mês */}
                    <td className="px-5 py-4 font-bold text-text-primary">
                      <div className="flex items-center gap-2">
                        <span>{m.labelCompleto}</span>
                        {m.isAtual && (
                          <span className="badge border border-border bg-surface text-[9px] text-text-secondary">
                            Atual
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quantidade Vigente */}
                    <td className="px-5 py-4 text-center font-mono font-bold text-text-primary">
                      {m.contratosVigentes.length} {m.contratosVigentes.length === 1 ? 'cliente' : 'clientes'}
                    </td>

                    {/* Contratos que Encerram */}
                    <td className="px-5 py-4">
                      {m.contratosExpirandoNoMes.length === 0 ? (
                        <span className="text-text-secondary/60 italic">Nenhum contrato encerra</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="badge border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold inline-flex items-center gap-1">
                            <AlertTriangle size={11} />
                            <span>
                              {m.contratosExpirandoNoMes.length} {m.contratosExpirandoNoMes.length === 1 ? 'cliente encerra' : 'clientes encerram'} ({formatCurrency(m.valorEmRiscoExpiracao)}/mês)
                            </span>
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Receita */}
                    <td className="px-5 py-4 text-right font-display tabular-nums text-success font-bold text-sm">
                      {formatCurrency(m.receitaContratada)}
                    </td>

                    {/* Custos */}
                    <td className="px-5 py-4 text-right font-display tabular-nums text-danger font-semibold">
                      {formatCurrency(m.despesaTotalProjetada)}
                    </td>

                    {/* Lucro */}
                    <td className="px-5 py-4 text-right font-display tabular-nums text-gold font-bold text-sm">
                      {formatCurrency(m.lucroLiquidoProjetado)}
                    </td>

                    {/* Ação */}
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMesSelecionadoDetalhe(m.index)
                        }}
                        className="text-xs text-gold hover:text-white underline font-semibold"
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Painel do Mês em Detalhe */}
      {mesEmFoco && (
        <div className="card border-gold/30 bg-surface-elevated p-5 animate-scale-in">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <div>
              <h4 className="font-display text-sm font-bold text-text-primary">
                Inspecionando {mesEmFoco.labelCompleto}
              </h4>
              <p className="text-xs text-text-secondary">
                Lista de todos os contratos que estarão vigentes ou expirando neste mês
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Faturamento Previsto</span>
              <span className="font-display text-base font-bold text-gold">{formatCurrency(mesEmFoco.receitaContratada)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lista de Contratos Vigentes */}
            <div>
              <h5 className="text-xs font-bold text-text-primary mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-success" />
                <span>Contratos Vigentes ({mesEmFoco.contratosVigentes.length})</span>
              </h5>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {mesEmFoco.contratosVigentes.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded bg-surface border border-border text-xs">
                    <div>
                      <span className="font-semibold text-text-primary block">{c.nome}</span>
                      <span className="text-[10px] text-text-secondary">
                        Vigência: {c.data_inicio_contrato ? new Date(c.data_inicio_contrato).toLocaleDateString('pt-BR') : 'Início'} 
                        {' → '} 
                        {c.data_fim_contrato ? new Date(c.data_fim_contrato).toLocaleDateString('pt-BR') : 'Contínuo'}
                      </span>
                    </div>
                    <span className="font-display font-bold text-success text-xs">
                      {formatCurrency(c.valor_contrato || 0)}/mês
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contratos que Expiram neste Mês */}
            <div>
              <h5 className="text-xs font-bold text-text-primary mb-2 flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-400" />
                <span>Contratos que Expiram Neste Mês ({mesEmFoco.contratosExpirandoNoMes.length})</span>
              </h5>
              {mesEmFoco.contratosExpirandoNoMes.length === 0 ? (
                <div className="p-4 rounded-lg bg-surface border border-border text-center text-xs text-text-secondary italic">
                  Nenhum contrato encerra neste mês. Todos os contratos vigentes continuarão ativos.
                </div>
              ) : (
                <div className="space-y-2">
                  {mesEmFoco.contratosExpirandoNoMes.map(c => (
                    <div key={c.id} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary">{c.nome}</span>
                        <span className="font-mono text-amber-400 font-bold">{formatCurrency(c.valor_contrato || 0)}/mês</span>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-1">
                        Data final de contrato: <strong className="text-amber-300">{new Date(c.data_fim_contrato!).toLocaleDateString('pt-BR')}</strong>.
                        Se não for renovado com o cliente, a receita deixará de entrar a partir do mês seguinte.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
