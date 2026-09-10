'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  DollarSign,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  Building2,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Layers,
  FileText
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Lancamento, CategoriaFinanceiro, Cliente, ClientePublico, Projeto, EmpresaGrupo, Cobranca } from '@/types'

import FinanceiroGraficos from './FinanceiroGraficos'
import FinanceiroContratos from './FinanceiroContratos'
import FinanceiroDespesas from './FinanceiroDespesas'
import FinanceiroPrevisao from './FinanceiroPrevisao'
import LancamentoModal from './LancamentoModal'
import CategoriasModal from './CategoriasModal'

interface FinanceiroClientViewProps {
  lancamentosIniciais: Lancamento[]
  categoriasIniciais: CategoriaFinanceiro[]
  clientesIniciais: Cliente[]
  projetosIniciais: Projeto[]
  cobrancasIniciais?: Cobranca[]
  currentUserId: string
}

type TabType = 'visao_geral' | 'contratos' | 'despesas' | 'previsao'
type PeriodoType = 'mes_atual' | 'mes_anterior' | 'ultimos_3_meses' | 'ano_atual' | 'todos'

export default function FinanceiroClientView({
  lancamentosIniciais,
  categoriasIniciais,
  clientesIniciais,
  projetosIniciais,
  cobrancasIniciais = [],
  currentUserId
}: FinanceiroClientViewProps) {
  // Estado principal
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lancamentosIniciais)
  const [categorias, setCategorias] = useState<CategoriaFinanceiro[]>(categoriasIniciais)
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais)
  const [cobrancas, setCobrancas] = useState<Cobranca[]>(cobrancasIniciais)
  const [projetos] = useState<Projeto[]>(projetosIniciais)

  // Abas e Filtros da Holding
  const [abaAtiva, setAbaAtiva] = useState<TabType>('visao_geral')
  const [empresaFiltro, setEmpresaFiltro] = useState<'todos' | 'jota_esportivo' | 'jota_tech' | 'holding'>('todos')
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoType>('mes_atual')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos')

  // Modais
  const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false)
  const [isCategoriasModalOpen, setIsCategoriasModalOpen] = useState(false)
  const [lancamentoParaEditar, setLancamentoParaEditar] = useState<Lancamento | null>(null)

  // Datas de referência
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // 1. Filtro por Período
  const lancamentosNoPeriodo = useMemo(() => {
    return lancamentos.filter(l => {
      if (!l.data_lancamento) return true

      const [anoStr, mesStr] = l.data_lancamento.split('-')
      const lYear = parseInt(anoStr, 10)
      const lMonth = parseInt(mesStr, 10) - 1 // 0-indexado

      if (periodoFiltro === 'mes_atual') {
        return lYear === year && lMonth === month
      }
      if (periodoFiltro === 'mes_anterior') {
        const prevMonth = month === 0 ? 11 : month - 1
        const prevYear = month === 0 ? year - 1 : year
        return lYear === prevYear && lMonth === prevMonth
      }
      if (periodoFiltro === 'ultimos_3_meses') {
        const dataLimite = new Date(year, month - 2, 1)
        const dLanc = new Date(l.data_lancamento)
        return dLanc >= dataLimite
      }
      if (periodoFiltro === 'ano_atual') {
        return lYear === year
      }
      return true // 'todos'
    })
  }, [lancamentos, periodoFiltro, year, month])

  // 2. Filtro por Empresa
  const lancamentosPorEmpresa = useMemo(() => {
    return lancamentosNoPeriodo.filter(l => {
      const emp = l.empresa || 'jota_esportivo'
      return empresaFiltro === 'todos' || emp === empresaFiltro
    })
  }, [lancamentosNoPeriodo, empresaFiltro])

  // 3. Filtro Completo (Busca, Tipo, Categoria) para a Tabela
  const lancamentosFiltrados = useMemo(() => {
    return lancamentosPorEmpresa.filter(l => {
      const matchSearch = l.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (l.cliente?.nome && l.cliente.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (l.projeto?.nome && l.projeto.nome.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchTipo = tipoFiltro === 'todos' || l.tipo === tipoFiltro
      const matchCat = categoriaFiltro === 'todos' || l.categoria_id === categoriaFiltro

      return matchSearch && matchTipo && matchCat
    })
  }, [lancamentosPorEmpresa, searchTerm, tipoFiltro, categoriaFiltro])

  // Cálculos de KPIs do período ativo
  const kpis = useMemo(() => {
    const receitas = lancamentosPorEmpresa
      .filter(l => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0)

    const despesas = lancamentosPorEmpresa
      .filter(l => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0)

    const margem = receitas - despesas
    const margemPerc = receitas > 0 ? (margem / receitas) * 100 : 0

    // Contagem de transações
    const totalEntradas = lancamentosPorEmpresa.filter(l => l.tipo === 'receita').length
    const totalSaidas = lancamentosPorEmpresa.filter(l => l.tipo === 'despesa').length

    return {
      receitas,
      despesas,
      margem,
      margemPerc,
      totalEntradas,
      totalSaidas
    }
  }, [lancamentosPorEmpresa])

  // Manipulação de Lançamentos
  function handleNovoLancamento() {
    setLancamentoParaEditar(null)
    setIsLancamentoModalOpen(true)
  }

  function handleEditarLancamento(l: Lancamento) {
    setLancamentoParaEditar(l)
    setIsLancamentoModalOpen(true)
  }

  function handleLancamentoSucesso(salvo: Lancamento, isEdit: boolean) {
    if (isEdit) {
      setLancamentos(prev => prev.map(l => l.id === salvo.id ? salvo : l))
    } else {
      setLancamentos(prev => [salvo, ...prev])
    }
  }

  async function handleExcluirLancamento(id: string, desc: string) {
    if (!confirm(`Deseja realmente excluir o lançamento "${desc}"?`)) return

    const supabase = createClient()
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir lançamento: ' + error.message)
    } else {
      setLancamentos(prev => prev.filter(l => l.id !== id))
      toast.success('Lançamento excluído com sucesso!')
    }
  }

  // Exportação Excel
  function handleExportarExcel() {
    try {
      const dataToExport = lancamentosFiltrados.map(l => ({
        'Data': formatDate(l.data_lancamento),
        'Tipo': l.tipo === 'receita' ? 'Receita (+)' : 'Despesa (-)',
        'Empresa': l.empresa === 'jota_tech' ? 'Jota Tech' : l.empresa === 'holding' ? 'Holding' : 'Jota Esportivo',
        'Descrição': l.descricao,
        'Categoria': l.categoria?.nome || 'Sem Categoria',
        'Cliente': l.cliente?.nome || '',
        'Projeto': l.projeto?.nome || '',
        'Valor (R$)': l.valor,
      }))

      const ws = XLSX.utils.json_to_sheet(dataToExport)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Financeiro')

      const fileName = `Financeiro_Jota_${empresaFiltro}_${periodoFiltro}_${now.toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success('Relatório financeiro exportado em Excel!')
    } catch (err) {
      console.error('Erro ao exportar:', err)
      toast.error('Erro ao gerar arquivo Excel.')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Barra de Topo da Holding Grupo Jota */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-surface border border-border p-4 rounded-xl">
        {/* Seletor Multi-Empresa da Holding */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-elevated rounded-lg border border-border overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => setEmpresaFiltro('todos')}
            className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              empresaFiltro === 'todos'
                ? 'bg-surface text-text-primary shadow-sm border border-border/80'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Building2 size={13} className="text-gold" />
            <span>🏢 Grupo Jota (Holding)</span>
          </button>
          <button
            onClick={() => setEmpresaFiltro('jota_esportivo')}
            className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              empresaFiltro === 'jota_esportivo'
                ? 'bg-gold-muted text-gold border border-gold/30 shadow-gold-glow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>⚽ Jota Esportivo</span>
          </button>
          <button
            onClick={() => setEmpresaFiltro('jota_tech')}
            className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              empresaFiltro === 'jota_tech'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>💻 Jota Tech</span>
          </button>
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsCategoriasModalOpen(true)}
            className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
            title="Gerenciar Categorias"
          >
            <Layers size={14} />
            <span>Categorias</span>
          </button>
          <Link
            href="/financeiro/importar"
            className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
          >
            <Upload size={14} />
            <span>Importar</span>
          </Link>
          <button
            onClick={handleExportarExcel}
            className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
            title="Exportar Planilha Excel"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
          <button
            onClick={handleNovoLancamento}
            className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-gold-glow"
          >
            <Plus size={15} />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Navegação de Abas do Módulo Financeiro */}
      <div className="flex items-center border-b border-border bg-surface px-4 rounded-xl overflow-x-auto">
        <button
          onClick={() => setAbaAtiva('visao_geral')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            abaAtiva === 'visao_geral'
              ? 'border-gold text-gold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <TrendingUp size={14} />
          <span>Visão Geral & Lançamentos</span>
        </button>

        <button
          onClick={() => setAbaAtiva('contratos')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            abaAtiva === 'contratos'
              ? 'border-gold text-gold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText size={14} />
          <span>Contratos & Clientes (MRR)</span>
          <span className="bg-gold-muted text-gold text-[9px] px-1.5 py-0.5 rounded-full font-bold">
            {clientes.filter(c => c.status === 'ativo').length}
          </span>
        </button>

        <button
          onClick={() => setAbaAtiva('despesas')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            abaAtiva === 'despesas'
              ? 'border-gold text-gold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <TrendingDown size={14} />
          <span>Despesas & Centros de Custo</span>
        </button>

        <button
          onClick={() => setAbaAtiva('previsao')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            abaAtiva === 'previsao'
              ? 'border-gold text-gold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Calendar size={14} />
          <span>Previsão Futura (Forecast)</span>
          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
            1-6 Meses
          </span>
        </button>
      </div>

      {/* ─── ABA 1: VISÃO GERAL & LANÇAMENTOS ────────────────────────────────────────── */}
      {abaAtiva === 'visao_geral' && (
        <div className="space-y-6 animate-fade-in">
          {/* Seletor de Período e KPIs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface border border-border p-3.5 rounded-xl">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-gold" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Período de Análise:</span>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-surface-elevated rounded-lg border border-border overflow-x-auto">
              <button
                onClick={() => setPeriodoFiltro('mes_atual')}
                className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                  periodoFiltro === 'mes_atual' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
                }`}
              >
                Mês Atual
              </button>
              <button
                onClick={() => setPeriodoFiltro('mes_anterior')}
                className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                  periodoFiltro === 'mes_anterior' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
                }`}
              >
                Mês Anterior
              </button>
              <button
                onClick={() => setPeriodoFiltro('ultimos_3_meses')}
                className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                  periodoFiltro === 'ultimos_3_meses' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
                }`}
              >
                Últimos 3 Meses
              </button>
              <button
                onClick={() => setPeriodoFiltro('ano_atual')}
                className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                  periodoFiltro === 'ano_atual' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
                }`}
              >
                Ano {year}
              </button>
              <button
                onClick={() => setPeriodoFiltro('todos')}
                className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                  periodoFiltro === 'todos' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
                }`}
              >
                Histórico Geral
              </button>
            </div>
          </div>

          {/* Grid de KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Receitas */}
            <div className="card border-success/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Entradas (Receitas)</span>
                <span className="text-[9px] bg-success/15 text-success font-bold px-1.5 py-0.5 rounded">
                  {kpis.totalEntradas} entradas
                </span>
              </div>
              <p className="kpi-number text-success mt-2">{formatCurrency(kpis.receitas)}</p>
              <p className="text-[10px] text-text-secondary mt-1">Faturamento total do período</p>
            </div>

            {/* Despesas */}
            <div className="card border-danger/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Saídas (Despesas)</span>
                <span className="text-[9px] bg-danger/15 text-danger font-bold px-1.5 py-0.5 rounded">
                  {kpis.totalSaidas} saídas
                </span>
              </div>
              <p className="kpi-number text-danger mt-2">{formatCurrency(kpis.despesas)}</p>
              <p className="text-[10px] text-text-secondary mt-1">Custos operacionais e despesas</p>
            </div>

            {/* Margem Líquida */}
            <div className={`card ${kpis.margem >= 0 ? 'border-gold/30 shadow-gold-glow' : 'border-danger/30'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Margem Líquida (Lucro)</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${kpis.margem >= 0 ? 'bg-gold-muted text-gold' : 'bg-danger/20 text-danger'}`}>
                  {kpis.margemPerc.toFixed(1)}%
                </span>
              </div>
              <p className={`kpi-number mt-2 ${kpis.margem >= 0 ? 'text-gold' : 'text-danger'}`}>
                {formatCurrency(kpis.margem)}
              </p>
              <p className="text-[10px] text-text-secondary mt-1">Saldo financeiro livre em caixa</p>
            </div>

            {/* Ticket Médio */}
            <div className="card border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Ticket Médio / Cliente</span>
                <DollarSign size={16} className="text-text-secondary" />
              </div>
              <p className="kpi-number text-text-primary mt-2">
                {formatCurrency(kpis.totalEntradas > 0 ? kpis.receitas / kpis.totalEntradas : 0)}
              </p>
              <p className="text-[10px] text-text-secondary mt-1">Média por faturamento recebido</p>
            </div>
          </div>

          {/* Gráficos Recharts */}
          <FinanceiroGraficos lancamentos={lancamentosPorEmpresa} categorias={categorias} />

          {/* Barra de Filtros e Busca da Tabela */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-surface border border-border p-4 rounded-xl">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Busca */}
              <div className="relative flex-1 min-w-[200px] md:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                <input
                  type="text"
                  placeholder="Buscar lançamento, cliente ou projeto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="input pl-9 py-1.5 text-xs"
                />
              </div>

              {/* Filtro Tipo */}
              <div className="flex items-center p-1 bg-surface-elevated rounded-lg border border-border">
                <button
                  onClick={() => setTipoFiltro('todos')}
                  className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                    tipoFiltro === 'todos' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setTipoFiltro('receita')}
                  className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                    tipoFiltro === 'receita' ? 'bg-success text-black' : 'text-text-secondary'
                  }`}
                >
                  Receitas
                </button>
                <button
                  onClick={() => setTipoFiltro('despesa')}
                  className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                    tipoFiltro === 'despesa' ? 'bg-danger text-white' : 'text-text-secondary'
                  }`}
                >
                  Despesas
                </button>
              </div>

              {/* Filtro Categoria */}
              <select
                value={categoriaFiltro}
                onChange={e => setCategoriaFiltro(e.target.value)}
                className="input py-1.5 pr-8 text-xs bg-surface-elevated font-medium"
              >
                <option value="todos">Categoria: Todas</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <span className="text-xs text-text-secondary font-mono self-end md:self-auto">
              {lancamentosFiltrados.length} lançamentos encontrados
            </span>
          </div>

          {/* Tabela de Lançamentos */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Data</th>
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Descrição</th>
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Empresa</th>
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Categoria</th>
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Cliente / Projeto</th>
                    <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Valor</th>
                    <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lancamentosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-text-secondary italic">
                        Nenhum lançamento registrado no período com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    lancamentosFiltrados.map(l => {
                      const emp = l.empresa || 'jota_esportivo'

                      return (
                        <tr key={l.id} className="hover:bg-surface-elevated/40 transition-colors">
                          <td className="px-5 py-3.5 text-text-secondary">{formatDate(l.data_lancamento)}</td>
                          <td className="px-5 py-3.5 font-medium text-text-primary">{l.descricao}</td>
                          <td className="px-5 py-3.5">
                            {emp === 'jota_tech' && (
                              <span className="badge border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[10px]">
                                💻 Tech
                              </span>
                            )}
                            {emp === 'holding' && (
                              <span className="badge border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px]">
                                🏢 Holding
                              </span>
                            )}
                            {emp === 'jota_esportivo' && (
                              <span className="badge border border-gold/30 bg-gold-muted text-gold text-[10px]">
                                ⚽ Esportivo
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {l.categoria ? (
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.categoria.cor || '#C9A84C' }} />
                                <span className="text-text-secondary text-xs">{l.categoria.nome}</span>
                              </span>
                            ) : (
                              <span className="text-text-secondary/50">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-text-secondary text-xs">
                            {l.cliente?.nome || l.projeto?.nome || '—'}
                          </td>
                          <td className={`px-5 py-3.5 text-right font-display font-bold tabular-nums text-sm ${
                            l.tipo === 'receita' ? 'text-success' : 'text-danger'
                          }`}>
                            {l.tipo === 'despesa' ? '−' : '+'}{formatCurrency(l.valor)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditarLancamento(l)}
                                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
                                title="Editar Lançamento"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleExcluirLancamento(l.id, l.descricao)}
                                className="p-1.5 text-text-secondary hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
                                title="Excluir Lançamento"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
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
      )}

      {/* ─── ABA 2: CONTRATOS & CLIENTES (MRR) ────────────────────────────────────── */}
      {abaAtiva === 'contratos' && (
        <FinanceiroContratos
          clientes={clientes}
          projetos={projetos}
          cobrancas={cobrancas}
          filtroEmpresaGlobal={empresaFiltro}
          currentUserId={currentUserId}
          onClientesChange={setClientes}
          onCobrancasChange={setCobrancas}
          onLancamentoCreated={(l) => setLancamentos(prev => [l, ...prev])}
        />
      )}

      {/* ─── ABA 3: DESPESAS & CENTROS DE CUSTO ──────────────────────────────────── */}
      {abaAtiva === 'despesas' && (
        <FinanceiroDespesas
          lancamentos={lancamentos}
          categorias={categorias}
          onNovoLancamento={handleNovoLancamento}
          onEditarLancamento={handleEditarLancamento}
        />
      )}

      {/* ─── ABA 4: PREVISÃO FINANCEIRA (FORECAST) ────────────────────────────────── */}
      {abaAtiva === 'previsao' && (
        <FinanceiroPrevisao
          clientes={clientes}
          lancamentos={lancamentos}
          filtroEmpresaGlobal={empresaFiltro}
        />
      )}

      {/* Modais Integrados */}
      <LancamentoModal
        isOpen={isLancamentoModalOpen}
        onClose={() => { setIsLancamentoModalOpen(false); setLancamentoParaEditar(null) }}
        onSuccess={handleLancamentoSucesso}
        categorias={categorias}
        clientes={clientes}
        projetos={projetos}
        currentUserId={currentUserId}
        lancamentoParaEditar={lancamentoParaEditar}
        defaultEmpresa={empresaFiltro === 'todos' ? 'jota_esportivo' : empresaFiltro}
      />

      <CategoriasModal
        isOpen={isCategoriasModalOpen}
        onClose={() => setIsCategoriasModalOpen(false)}
        categorias={categorias}
        onCategoriasChange={setCategorias}
      />
    </div>
  )
}
