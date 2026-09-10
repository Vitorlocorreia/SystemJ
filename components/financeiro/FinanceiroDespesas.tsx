'use client'

import { useMemo, useState } from 'react'
import {
  TrendingDown,
  Building2,
  PieChart as PieIcon,
  Search,
  Plus,
  Filter,
  ArrowDownRight
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Lancamento, CategoriaFinanceiro } from '@/types'

interface FinanceiroDespesasProps {
  lancamentos: Lancamento[]
  categorias: CategoriaFinanceiro[]
  onNovoLancamento: () => void
  onEditarLancamento: (l: Lancamento) => void
}

export default function FinanceiroDespesas({
  lancamentos,
  categorias,
  onNovoLancamento,
  onEditarLancamento
}: FinanceiroDespesasProps) {
  const [empresaFiltro, setEmpresaFiltro] = useState<'todas' | 'jota_esportivo' | 'jota_tech' | 'holding'>('todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')

  // Apenas saídas / despesas
  const todasDespesas = useMemo(() => {
    return lancamentos.filter(l => l.tipo === 'despesa')
  }, [lancamentos])

  // Despesas por empresa
  const totaisPorEmpresa = useMemo(() => {
    let totalGeral = 0
    let esportivo = 0
    let tech = 0
    let holding = 0

    todasDespesas.forEach(d => {
      totalGeral += d.valor
      const emp = d.empresa || 'jota_esportivo'
      if (emp === 'jota_tech') tech += d.valor
      else if (emp === 'holding') holding += d.valor
      else esportivo += d.valor
    })

    return { totalGeral, esportivo, tech, holding }
  }, [todasDespesas])

  // Despesas filtradas para exibição
  const despesasFiltradas = useMemo(() => {
    return todasDespesas.filter(d => {
      const emp = d.empresa || 'jota_esportivo'
      const matchEmp = empresaFiltro === 'todas' || emp === empresaFiltro
      const matchSearch = d.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (d.categoria?.nome && d.categoria.nome.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchCat = categoriaFiltro === 'todas' || d.categoria_id === categoriaFiltro

      return matchEmp && matchSearch && matchCat
    })
  }, [todasDespesas, empresaFiltro, searchTerm, categoriaFiltro])

  // Categorias de despesa disponíveis
  const categoriasDespesa = useMemo(() => {
    return categorias.filter(c => c.tipo === 'despesa')
  }, [categorias])

  return (
    <div className="space-y-6">
      {/* Cards de Despesas por Empresa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Consolidado */}
        <div className="card border-danger/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Despesas Consolidadas</span>
            <TrendingDown size={16} className="text-danger" />
          </div>
          <p className="kpi-number text-danger mt-2">{formatCurrency(totaisPorEmpresa.totalGeral)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Total de saídas do Grupo Jota</p>
        </div>

        {/* Jota Esportivo */}
        <div className="card border-gold/20 hover:border-gold/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gold uppercase tracking-wider">⚽ Jota Esportivo</span>
            <span className="text-[9px] bg-gold-muted text-gold px-1.5 py-0.5 rounded font-bold">
              {totaisPorEmpresa.totalGeral > 0 ? ((totaisPorEmpresa.esportivo / totaisPorEmpresa.totalGeral) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <p className="kpi-number text-text-primary mt-2">{formatCurrency(totaisPorEmpresa.esportivo)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Filmmakers, diárias, equipamentos, viagens</p>
        </div>

        {/* Jota Tech */}
        <div className="card border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">💻 Jota Tech</span>
            <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-bold">
              {totaisPorEmpresa.totalGeral > 0 ? ((totaisPorEmpresa.tech / totaisPorEmpresa.totalGeral) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <p className="kpi-number text-cyan-400 mt-2">{formatCurrency(totaisPorEmpresa.tech)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Servidores, cloud, licenças e equipe dev</p>
        </div>

        {/* Holding Geral */}
        <div className="card border-purple-500/20 hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">🏢 Holding Geral</span>
            <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-bold">
              {totaisPorEmpresa.totalGeral > 0 ? ((totaisPorEmpresa.holding / totaisPorEmpresa.totalGeral) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <p className="kpi-number text-purple-400 mt-2">{formatCurrency(totaisPorEmpresa.holding)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Contabilidade, impostos corporativos, sede</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-surface border border-border p-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px] md:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
            <input
              type="text"
              placeholder="Buscar despesa ou fornecedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-9 py-1.5 text-xs"
            />
          </div>

          {/* Filtro por Empresa */}
          <div className="flex items-center p-1 bg-surface-elevated rounded-lg border border-border">
            <button
              onClick={() => setEmpresaFiltro('todas')}
              className={`py-1 px-2.5 rounded text-xs font-semibold transition-all ${
                empresaFiltro === 'todas' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setEmpresaFiltro('jota_esportivo')}
              className={`py-1 px-2.5 rounded text-xs font-semibold transition-all ${
                empresaFiltro === 'jota_esportivo' ? 'bg-gold-muted text-gold' : 'text-text-secondary'
              }`}
            >
              ⚽ Esportivo
            </button>
            <button
              onClick={() => setEmpresaFiltro('jota_tech')}
              className={`py-1 px-2.5 rounded text-xs font-semibold transition-all ${
                empresaFiltro === 'jota_tech' ? 'bg-cyan-500/10 text-cyan-400' : 'text-text-secondary'
              }`}
            >
              💻 Tech
            </button>
            <button
              onClick={() => setEmpresaFiltro('holding')}
              className={`py-1 px-2.5 rounded text-xs font-semibold transition-all ${
                empresaFiltro === 'holding' ? 'bg-purple-500/10 text-purple-400' : 'text-text-secondary'
              }`}
            >
              🏢 Holding
            </button>
          </div>

          {/* Categoria Filtro */}
          <select
            value={categoriaFiltro}
            onChange={e => setCategoriaFiltro(e.target.value)}
            className="input py-1.5 pr-8 text-xs bg-surface-elevated font-medium"
          >
            <option value="todas">Categoria: Todas</option>
            {categoriasDespesa.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onNovoLancamento}
          className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3 w-full md:w-auto justify-center"
        >
          <Plus size={14} />
          <span>Registrar Despesa</span>
        </button>
      </div>

      {/* Tabela Detalhada de Despesas */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface-elevated flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">Demonstrativo de Saídas</h3>
            <p className="text-xs text-text-secondary">Rastreamento de custos operacionais e fornecedores</p>
          </div>
          <span className="text-xs font-mono text-danger bg-danger/10 px-2.5 py-1 rounded-full border border-danger/20 font-bold">
            {despesasFiltradas.length} despesas listadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Data</th>
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Descrição / Destino</th>
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Empresa</th>
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Categoria</th>
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Projeto / Cliente</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Valor Saída</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {despesasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-text-secondary italic">
                    Nenhuma despesa encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                despesasFiltradas.map(d => {
                  const emp = d.empresa || 'jota_esportivo'

                  return (
                    <tr
                      key={d.id}
                      onClick={() => onEditarLancamento(d)}
                      className="hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5 text-text-secondary">{formatDate(d.data_lancamento)}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-text-primary group-hover:text-gold transition-colors">
                          {d.descricao}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {emp === 'jota_tech' && (
                          <span className="badge border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[10px]">
                            💻 Jota Tech
                          </span>
                        )}
                        {emp === 'holding' && (
                          <span className="badge border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px]">
                            🏢 Holding
                          </span>
                        )}
                        {emp === 'jota_esportivo' && (
                          <span className="badge border border-gold/30 bg-gold-muted text-gold text-[10px]">
                            ⚽ Jota Esportivo
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {d.categoria ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.categoria.cor || '#EF4444' }} />
                            <span className="text-text-secondary text-xs">{d.categoria.nome}</span>
                          </span>
                        ) : (
                          <span className="text-text-secondary/50">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary text-xs">
                        {d.projeto?.nome || d.cliente?.nome || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-display font-bold tabular-nums text-danger text-sm">
                        −{formatCurrency(d.valor)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
