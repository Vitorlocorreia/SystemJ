'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { Lancamento, CategoriaFinanceiro } from '@/types'

interface FinanceiroGraficosProps {
  lancamentos: Lancamento[]
  categorias: CategoriaFinanceiro[]
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function FinanceiroGraficos({ lancamentos, categorias }: FinanceiroGraficosProps) {
  // Agrupamento por Mês (últimos 6 meses)
  const monthlyData = useMemo(() => {
    const map: Record<string, { monthKey: string; label: string; receitas: number; despesas: number; saldo: number }> = {}

    // Pegar os últimos 6 meses até hoje
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map[key] = {
        monthKey: key,
        label: `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
        receitas: 0,
        despesas: 0,
        saldo: 0,
      }
    }

    lancamentos.forEach(l => {
      if (!l.data_lancamento) return
      const key = l.data_lancamento.slice(0, 7)
      if (map[key]) {
        if (l.tipo === 'receita') {
          map[key].receitas += l.valor
        } else {
          map[key].despesas += l.valor
        }
        map[key].saldo = map[key].receitas - map[key].despesas
      }
    })

    return Object.values(map)
  }, [lancamentos])

  // Distribuição de Despesas por Categoria
  const categoryExpensesData = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {}

    lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
      const catName = l.categoria?.nome || 'Sem Categoria'
      const catColor = l.categoria?.cor || '#EF4444'

      if (!map[catName]) {
        map[catName] = { name: catName, value: 0, color: catColor }
      }
      map[catName].value += l.valor
    })

    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [lancamentos])

  // Comparativo por Empresa
  const companyDistribution = useMemo(() => {
    let esportivo = 0
    let tech = 0
    let holding = 0

    lancamentos.forEach(l => {
      const val = l.tipo === 'receita' ? l.valor : -l.valor
      if (l.empresa === 'jota_tech') tech += val
      else if (l.empresa === 'holding') holding += val
      else esportivo += val
    })

    return [
      { name: 'Jota Esportivo', value: Math.max(0, esportivo), color: '#C9A84C' },
      { name: 'Jota Tech', value: Math.max(0, tech), color: '#06B6D4' },
      { name: 'Holding', value: Math.max(0, holding), color: '#A855F7' },
    ].filter(item => item.value > 0)
  }, [lancamentos])

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Gráfico de Fluxo de Caixa Mensal */}
      <div className="lg:col-span-2 card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">Evolução de Fluxo de Caixa</h3>
            <p className="text-[11px] text-text-secondary">Comparativo mensal de receitas versus despesas (últimos 6 meses)</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
              />
              <Bar dataKey="receitas" name="Receitas (+)" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="despesas" name="Despesas (−)" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico Donut de Despesas por Categoria */}
      <div className="card p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-text-primary">Maiores Centros de Custo</h3>
          <p className="text-[11px] text-text-secondary">Distribuição dos custos por categoria</p>
        </div>

        {categoryExpensesData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-text-secondary opacity-60">Sem despesas registradas no período.</p>
          </div>
        ) : (
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryExpensesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryExpensesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Gasto']}
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333333', borderRadius: '8px', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legenda compacta inferior */}
            <div className="grid grid-cols-2 gap-1 text-[10px] mt-1 max-h-16 overflow-y-auto pr-1">
              {categoryExpensesData.map(c => (
                <div key={c.name} className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-text-secondary truncate">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
