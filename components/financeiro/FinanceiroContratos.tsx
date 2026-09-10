'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Users,
  Search,
  Building2,
  DollarSign,
  Briefcase,
  TrendingUp,
  Edit2,
  CheckCircle,
  X,
  Plus
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Cliente, Projeto, EmpresaGrupo } from '@/types'

interface FinanceiroContratosProps {
  clientes: Cliente[]
  projetos: Projeto[]
  filtroEmpresaGlobal: string
  onClientesChange: (clientes: Cliente[]) => void
}

export default function FinanceiroContratos({
  clientes,
  projetos,
  filtroEmpresaGlobal,
  onClientesChange
}: FinanceiroContratosProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'prospecto' | 'inativo'>('todos')
  
  // Modal de Edição de Contrato
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)
  const [novoValorContrato, setNovoValorContrato] = useState('')
  const [novoStatus, setNovoStatus] = useState<Cliente['status']>('ativo')
  const [novaEmpresa, setNovaEmpresa] = useState<EmpresaGrupo>('jota_esportivo')
  const [saving, setSaving] = useState(false)

  // Filtragem
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const matchSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.segmento && c.segmento.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchStatus = statusFiltro === 'todos' || c.status === statusFiltro

      const matchEmpresa = filtroEmpresaGlobal === 'todos' ||
                           (c.empresa || 'jota_esportivo') === filtroEmpresaGlobal

      return matchSearch && matchStatus && matchEmpresa
    })
  }, [clientes, searchTerm, statusFiltro, filtroEmpresaGlobal])

  // Métricas de Contratos
  const metricas = useMemo(() => {
    let mrrTotal = 0
    let mrrEsportivo = 0
    let mrrTech = 0
    let pipelineProspectos = 0

    clientes.forEach(c => {
      const valor = c.valor_contrato || 0
      const emp = c.empresa || 'jota_esportivo'

      if (c.status === 'ativo') {
        mrrTotal += valor
        if (emp === 'jota_tech') mrrTech += valor
        else mrrEsportivo += valor
      } else if (c.status === 'prospecto') {
        pipelineProspectos += valor
      }
    })

    return { mrrTotal, mrrEsportivo, mrrTech, pipelineProspectos }
  }, [clientes])

  function abrirEdicao(cliente: Cliente) {
    setClienteEditando(cliente)
    setNovoValorContrato(cliente.valor_contrato ? cliente.valor_contrato.toString() : '')
    setNovoStatus(cliente.status)
    setNovaEmpresa((cliente.empresa as EmpresaGrupo) || 'jota_esportivo')
  }

  async function handleSalvarContrato(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteEditando) return

    setSaving(true)
    const supabase = createClient()

    const valorNum = novoValorContrato ? parseFloat(novoValorContrato.replace(',', '.')) : null

    try {
      const { data, error } = await supabase
        .from('clientes')
        .update({
          valor_contrato: valorNum,
          status: novoStatus,
          empresa: novaEmpresa,
        })
        .eq('id', clienteEditando.id)
        .select('*')
        .single()

      if (error) throw error

      toast.success('Contrato do cliente atualizado com sucesso!')
      onClientesChange(clientes.map(c => c.id === clienteEditando.id ? data : c))
      setClienteEditando(null)
    } catch (err: any) {
      console.error('Erro ao atualizar contrato:', err)
      toast.error(err.message || 'Erro ao atualizar contrato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cards de Métricas de Contratos (MRR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Consolidado */}
        <div className="card border-gold/30 shadow-gold-glow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">MRR Consolidado</span>
            <Building2 size={16} className="text-gold" />
          </div>
          <p className="kpi-number text-gold mt-2">{formatCurrency(metricas.mrrTotal)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Faturamento mensal recorrente garantido</p>
        </div>

        {/* MRR Jota Esportivo */}
        <div className="card border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">⚽ Jota Esportivo MRR</span>
            <span className="text-xs">⚽</span>
          </div>
          <p className="kpi-number text-text-primary mt-2">{formatCurrency(metricas.mrrEsportivo)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Contratos de produções e assessoria</p>
        </div>

        {/* MRR Jota Tech */}
        <div className="card border-cyan-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">💻 Jota Tech MRR</span>
            <span className="text-xs">💻</span>
          </div>
          <p className="kpi-number text-cyan-400 mt-2">{formatCurrency(metricas.mrrTech)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Contratos de tecnologia e software</p>
        </div>

        {/* Pipeline de Prospectos */}
        <div className="card border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Pipeline Prospectos</span>
            <TrendingUp size={16} className="text-text-secondary" />
          </div>
          <p className="kpi-number text-text-secondary mt-2">{formatCurrency(metricas.pipelineProspectos)}</p>
          <p className="text-[10px] text-text-secondary mt-1">Negociações em andamento</p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-surface border border-border p-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Busca */}
          <div className="relative flex-1 min-w-[220px] md:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
            <input
              type="text"
              placeholder="Buscar por cliente ou segmento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-9 py-1.5 text-xs"
            />
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center p-1 bg-surface-elevated rounded-lg border border-border">
            <button
              onClick={() => setStatusFiltro('todos')}
              className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                statusFiltro === 'todos' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
              }`}
            >
              Todos ({clientes.length})
            </button>
            <button
              onClick={() => setStatusFiltro('ativo')}
              className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                statusFiltro === 'ativo' ? 'bg-success/20 text-success' : 'text-text-secondary'
              }`}
            >
              Ativos ({clientes.filter(c => c.status === 'ativo').length})
            </button>
            <button
              onClick={() => setStatusFiltro('prospecto')}
              className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                statusFiltro === 'prospecto' ? 'bg-gold-muted text-gold' : 'text-text-secondary'
              }`}
            >
              Prospectos ({clientes.filter(c => c.status === 'prospecto').length})
            </button>
            <button
              onClick={() => setStatusFiltro('inativo')}
              className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                statusFiltro === 'inativo' ? 'bg-surface text-text-secondary' : 'text-text-secondary'
              }`}
            >
              Inativos ({clientes.filter(c => c.status === 'inativo').length})
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Contratos dos Clientes */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface-elevated flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">Contratos & Clientes</h3>
            <p className="text-xs text-text-secondary">Valores mensais contratados e segmentação por empresa</p>
          </div>
          <span className="text-xs font-mono text-gold bg-gold-muted px-2.5 py-1 rounded-full border border-gold/20 font-bold">
            {clientesFiltrados.length} clientes listados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Empresa</th>
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Projetos Ativos</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Valor Mensal (MRR)</th>
                <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-text-secondary italic">
                    Nenhum cliente encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map(c => {
                  const emp = c.empresa || 'jota_esportivo'
                  const projetosDoCliente = projetos.filter(p => p.cliente_id === c.id)

                  return (
                    <tr key={c.id} className="hover:bg-surface-elevated/40 transition-colors">
                      {/* Cliente info */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary text-sm">{c.nome}</span>
                          <span className="text-[10px] text-text-secondary">{c.segmento || 'Sem segmento'}</span>
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="px-5 py-3.5">
                        {emp === 'jota_tech' ? (
                          <span className="badge border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[10px]">
                            💻 Jota Tech
                          </span>
                        ) : (
                          <span className="badge border border-gold/30 bg-gold-muted text-gold text-[10px]">
                            ⚽ Jota Esportivo
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        {c.status === 'ativo' && (
                          <span className="badge-success text-[10px] capitalize">Ativo</span>
                        )}
                        {c.status === 'prospecto' && (
                          <span className="badge-warning text-[10px] capitalize">Prospecto</span>
                        )}
                        {c.status === 'inativo' && (
                          <span className="badge-secondary text-[10px] capitalize">Inativo</span>
                        )}
                      </td>

                      {/* Projetos */}
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1 text-text-secondary">
                          <Briefcase size={12} className="text-text-secondary" />
                          <span>{projetosDoCliente.length} {projetosDoCliente.length === 1 ? 'projeto' : 'projetos'}</span>
                        </span>
                      </td>

                      {/* Valor Contrato */}
                      <td className="px-5 py-3.5 text-right font-display font-bold tabular-nums text-sm">
                        {c.valor_contrato ? (
                          <span className={c.status === 'ativo' ? 'text-success' : 'text-text-secondary'}>
                            {formatCurrency(c.valor_contrato)}/mês
                          </span>
                        ) : (
                          <span className="text-text-secondary/50 font-normal">Sob demanda</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => abrirEdicao(c)}
                          className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                        >
                          <Edit2 size={12} />
                          <span>Gerenciar Contrato</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição de Contrato */}
      {clienteEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-md rounded-xl overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
              <div>
                <h3 className="font-display text-base font-bold text-text-primary">Gerenciar Contrato</h3>
                <p className="text-xs text-gold font-medium">{clienteEditando.nome}</p>
              </div>
              <button
                onClick={() => setClienteEditando(null)}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarContrato} className="p-6 space-y-4">
              {/* Empresa Responsável */}
              <div>
                <label className="label mb-1.5">Empresa da Holding *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNovaEmpresa('jota_esportivo')}
                    className={`py-2 px-3 text-center rounded-lg border text-xs font-semibold transition-all ${
                      novaEmpresa === 'jota_esportivo'
                        ? 'border-gold bg-gold-muted text-gold font-bold'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    ⚽ Jota Esportivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovaEmpresa('jota_tech')}
                    className={`py-2 px-3 text-center rounded-lg border text-xs font-semibold transition-all ${
                      novaEmpresa === 'jota_tech'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 font-bold'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    💻 Jota Tech
                  </button>
                </div>
              </div>

              {/* Status do Cliente */}
              <div>
                <label className="label mb-1">Status da Conta *</label>
                <select
                  value={novoStatus}
                  onChange={e => setNovoStatus(e.target.value as any)}
                  className="input text-xs"
                >
                  <option value="ativo">Ativo (Contrato Vigente)</option>
                  <option value="prospecto">Prospecto (Em Negociação)</option>
                  <option value="inativo">Inativo (Encerrado / Pausado)</option>
                </select>
              </div>

              {/* Valor do Contrato */}
              <div>
                <label className="label mb-1">Valor do Contrato Mensal (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-mono text-sm">R$</span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={novoValorContrato}
                    onChange={e => setNovoValorContrato(e.target.value)}
                    className="input pl-10 font-display text-base font-bold tabular-nums"
                  />
                </div>
                <p className="text-[10px] text-text-secondary mt-1">
                  Insira o valor fixo mensal contratado (MRR). Deixe em branco se for job sob demanda.
                </p>
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setClienteEditando(null)}
                  disabled={saving}
                  className="btn-ghost text-xs py-2 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs py-2 px-5"
                >
                  {saving ? 'Salvando...' : 'Salvar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
