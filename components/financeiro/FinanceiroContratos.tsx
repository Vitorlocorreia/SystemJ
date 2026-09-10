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
  Calendar,
  AlertTriangle,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CreditCard
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Cliente, Projeto, EmpresaGrupo, Cobranca, Lancamento } from '@/types'

interface FinanceiroContratosProps {
  clientes: Cliente[]
  projetos: Projeto[]
  cobrancas: Cobranca[]
  filtroEmpresaGlobal: string
  currentUserId?: string
  onClientesChange: (clientes: Cliente[]) => void
  onCobrancasChange: (cobrancas: Cobranca[]) => void
  onLancamentoCreated?: (lancamento: Lancamento) => void
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function FinanceiroContratos({
  clientes,
  projetos,
  cobrancas,
  filtroEmpresaGlobal,
  currentUserId,
  onClientesChange,
  onCobrancasChange,
  onLancamentoCreated
}: FinanceiroContratosProps) {
  const [activeSubTab, setActiveSubTab] = useState<'mensalidades' | 'contratos'>('mensalidades')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'prospecto' | 'inativo'>('todos')
  
  // Controle de Mês de Referência (padrão: mês atual)
  const [dataReferencia, setDataReferencia] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Modal de Edição de Contrato (Vigência)
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)
  const [novoValorContrato, setNovoValorContrato] = useState('')
  const [novoStatus, setNovoStatus] = useState<Cliente['status']>('ativo')
  const [novaEmpresa, setNovaEmpresa] = useState<EmpresaGrupo>('jota_esportivo')
  const [novaDataInicio, setNovaDataInicio] = useState('')
  const [novaDataFim, setNovaDataFim] = useState('')
  const [contratoContinuo, setContratoContinuo] = useState(true)
  const [novoDiaVencimento, setNovoDiaVencimento] = useState(10)
  const [novaFormaPagamento, setNovaFormaPagamento] = useState('PIX')
  const [savingContrato, setSavingContrato] = useState(false)

  // Modal de Dar Baixa / Registrar Pagamento
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false)
  const [clientePagamento, setClientePagamento] = useState<Cliente | null>(null)
  const [cobrancaPagamento, setCobrancaPagamento] = useState<Cobranca | null>(null)
  const [tipoPagamento, setTipoPagamento] = useState<'integral' | 'parcial'>('integral')
  const [valorPagoInput, setValorPagoInput] = useState('')
  const [dataPagamentoInput, setDataPagamentoInput] = useState(() => new Date().toISOString().slice(0, 10))
  const [formaPagamentoInput, setFormaPagamentoInput] = useState('PIX')
  const [observacaoPagamento, setObservacaoPagamento] = useState('')
  const [lancarNoCaixa, setLancarNoCaixa] = useState(true)
  const [savingPagamento, setSavingPagamento] = useState(false)

  // Chave do mês atual no formato YYYY-MM-01
  const mesReferenciaKey = useMemo(() => {
    const y = dataReferencia.getFullYear()
    const m = String(dataReferencia.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}-01`
  }, [dataReferencia])

  const mesReferenciaLabel = useMemo(() => {
    return `${MONTH_NAMES[dataReferencia.getMonth()]} de ${dataReferencia.getFullYear()}`
  }, [dataReferencia])

  function navegarMes(offset: number) {
    setDataReferencia(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
  }

  // Filtragem de clientes por empresa global e busca
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

  // Lista de cobranças do mês de referência
  const cobrancasDoMes = useMemo(() => {
    return cobrancas.filter(c => c.mes_referencia?.startsWith(mesReferenciaKey.slice(0, 7)))
  }, [cobrancas, mesReferenciaKey])

  // Clientes com vigência ativa no mês de referência
  const clientesVigentesNoMes = useMemo(() => {
    const ano = dataReferencia.getFullYear()
    const mes = dataReferencia.getMonth()
    const inicioDoMes = new Date(ano, mes, 1).toISOString().slice(0, 10)
    const fimDoMes = new Date(ano, mes + 1, 0).toISOString().slice(0, 10)

    return clientesFiltrados.filter(c => {
      if (c.status !== 'ativo' || !c.valor_contrato || c.valor_contrato <= 0) return false

      // Começou em ou antes deste mês
      if (c.data_inicio_contrato && c.data_inicio_contrato > fimDoMes) return false

      // Terminou antes deste mês
      if (c.data_fim_contrato && c.data_fim_contrato < inicioDoMes) return false

      return true
    })
  }, [clientesFiltrados, dataReferencia])

  // Contratos que encerram especificamente neste mês
  const contratosAcabandoNoMes = useMemo(() => {
    const ano = dataReferencia.getFullYear()
    const mes = dataReferencia.getMonth()
    const inicioDoMes = new Date(ano, mes, 1).toISOString().slice(0, 10)
    const fimDoMes = new Date(ano, mes + 1, 0).toISOString().slice(0, 10)

    return clientesFiltrados.filter(c => {
      if (c.status !== 'ativo') return false
      if (!c.data_fim_contrato) return false
      return c.data_fim_contrato >= inicioDoMes && c.data_fim_contrato <= fimDoMes
    })
  }, [clientesFiltrados, dataReferencia])

  // Métricas do Mês de Referência
  const metricasDoMes = useMemo(() => {
    let faturamentoPrevisto = 0
    let faturamentoRecebido = 0
    let faturamentoPendente = 0
    let faturamentoAtrasado = 0
    let totalPagos = 0
    let totalParciais = 0
    let totalPendentes = 0
    let totalAtrasados = 0

    const hojeStr = new Date().toISOString().slice(0, 10)

    clientesVigentesNoMes.forEach(c => {
      const valorMensal = c.valor_contrato || 0
      faturamentoPrevisto += valorMensal

      const cobranca = cobrancasDoMes.find(cob => cob.cliente_id === c.id)
      const valorPago = cobranca ? Number(cobranca.valor_pago || 0) : 0
      const statusCob = cobranca?.status || 'pendente'

      faturamentoRecebido += valorPago
      const saldoRestante = Math.max(0, valorMensal - valorPago)

      const diaVenc = c.dia_vencimento || 10
      const dataVenc = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), diaVenc).toISOString().slice(0, 10)
      const isAtrasado = statusCob !== 'pago' && dataVenc < hojeStr

      if (statusCob === 'pago') {
        totalPagos++
      } else if (valorPago > 0 && saldoRestante > 0) {
        totalParciais++
        faturamentoPendente += saldoRestante
      } else if (isAtrasado) {
        totalAtrasados++
        faturamentoAtrasado += saldoRestante
        faturamentoPendente += saldoRestante
      } else {
        totalPendentes++
        faturamentoPendente += saldoRestante
      }
    })

    return {
      faturamentoPrevisto,
      faturamentoRecebido,
      faturamentoPendente,
      faturamentoAtrasado,
      totalPagos,
      totalParciais,
      totalPendentes,
      totalAtrasados
    }
  }, [clientesVigentesNoMes, cobrancasDoMes, dataReferencia])

  // Abrir modal de edição de contrato
  function abrirEdicao(cliente: Cliente) {
    setClienteEditando(cliente)
    setNovoValorContrato(cliente.valor_contrato ? cliente.valor_contrato.toString() : '')
    setNovoStatus(cliente.status)
    setNovaEmpresa((cliente.empresa as EmpresaGrupo) || 'jota_esportivo')
    setNovaDataInicio(cliente.data_inicio_contrato || new Date().toISOString().slice(0, 10))
    setNovaDataFim(cliente.data_fim_contrato || '')
    setContratoContinuo(!cliente.data_fim_contrato)
    setNovoDiaVencimento(cliente.dia_vencimento || 10)
    setNovaFormaPagamento(cliente.forma_pagamento || 'PIX')
  }

  // Salvar contrato
  async function handleSalvarContrato(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteEditando) return

    setSavingContrato(true)
    const supabase = createClient()
    const valorNum = novoValorContrato ? parseFloat(novoValorContrato.replace(',', '.')) : null

    try {
      const { data, error } = await supabase
        .from('clientes')
        .update({
          valor_contrato: valorNum,
          status: novoStatus,
          empresa: novaEmpresa,
          data_inicio_contrato: novaDataInicio || null,
          data_fim_contrato: contratoContinuo ? null : (novaDataFim || null),
          dia_vencimento: novoDiaVencimento,
          forma_pagamento: novaFormaPagamento
        })
        .eq('id', clienteEditando.id)
        .select('*')
        .single()

      if (error) throw error

      toast.success('Contrato e vigência atualizados com sucesso!')
      onClientesChange(clientes.map(c => c.id === clienteEditando.id ? data : c))
      setClienteEditando(null)
    } catch (err: any) {
      console.error('Erro ao atualizar contrato:', err)
      toast.error(err.message || 'Erro ao atualizar contrato.')
    } finally {
      setSavingContrato(false)
    }
  }

  // Abrir modal de registro de pagamento
  function abrirModalPagamento(cliente: Cliente) {
    const cobrancaExistente = cobrancasDoMes.find(c => c.cliente_id === cliente.id)
    setClientePagamento(cliente)
    setCobrancaPagamento(cobrancaExistente || null)

    const valorMensal = cliente.valor_contrato || 0
    const jaPago = cobrancaExistente ? Number(cobrancaExistente.valor_pago || 0) : 0
    const restante = Math.max(0, valorMensal - jaPago)

    setTipoPagamento('integral')
    setValorPagoInput(restante.toString())
    setDataPagamentoInput(new Date().toISOString().slice(0, 10))
    setFormaPagamentoInput(cliente.forma_pagamento || 'PIX')
    setObservacaoPagamento(cobrancaExistente?.observacao || '')
    setLancarNoCaixa(true)
    setModalPagamentoAberto(true)
  }

  // Registrar pagamento (Integral ou Parcial)
  async function handleSalvarPagamento(e: React.FormEvent) {
    e.preventDefault()
    if (!clientePagamento) return

    const valorMensal = clientePagamento.valor_contrato || 0
    const valorPagoSessao = parseFloat(valorPagoInput.replace(',', '.')) || 0

    if (valorPagoSessao <= 0) {
      toast.error('Informe um valor de pagamento válido maior que zero.')
      return
    }

    setSavingPagamento(true)
    const supabase = createClient()

    try {
      const diaVenc = clientePagamento.dia_vencimento || 10
      const dataVenc = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), diaVenc).toISOString().slice(0, 10)
      
      const jaPagoAnterior = cobrancaPagamento ? Number(cobrancaPagamento.valor_pago || 0) : 0
      const totalPagoAcumulado = jaPagoAnterior + valorPagoSessao

      let novoStatusCobranca: Cobranca['status'] = 'pendente'
      if (totalPagoAcumulado >= valorMensal) {
        novoStatusCobranca = 'pago'
      } else {
        novoStatusCobranca = 'parcial'
      }

      let cobrancaSalva: Cobranca

      if (cobrancaPagamento) {
        // Atualizar cobrança existente
        const { data, error } = await supabase
          .from('cobrancas')
          .update({
            valor_pago: totalPagoAcumulado,
            status: novoStatusCobranca,
            data_pagamento: new Date(dataPagamentoInput).toISOString(),
            observacao: observacaoPagamento || null
          })
          .eq('id', cobrancaPagamento.id)
          .select('*')
          .single()

        if (error) throw error
        cobrancaSalva = data
        onCobrancasChange(cobrancas.map(c => c.id === cobrancaSalva.id ? cobrancaSalva : c))
      } else {
        // Inserir nova cobrança
        const { data, error } = await supabase
          .from('cobrancas')
          .insert({
            cliente_id: clientePagamento.id,
            empresa: clientePagamento.empresa || 'jota_esportivo',
            mes_referencia: mesReferenciaKey,
            valor_total: valorMensal,
            valor_pago: totalPagoAcumulado,
            status: novoStatusCobranca,
            data_vencimento: dataVenc,
            data_pagamento: new Date(dataPagamentoInput).toISOString(),
            observacao: observacaoPagamento || null
          })
          .select('*')
          .single()

        if (error) throw error
        cobrancaSalva = data
        onCobrancasChange([cobrancaSalva, ...cobrancas])
      }

      // Se marcado para lançar no fluxo de caixa, cria o lançamento contábil
      if (lancarNoCaixa) {
        const descricaoLancamento = `Mensalidade ${mesReferenciaLabel} - ${clientePagamento.nome} (${novoStatusCobranca === 'pago' ? 'Integral' : 'Parcial'})`
        
        const { data: lancamentoData, error: lancamentoErr } = await supabase
          .from('lancamentos')
          .insert({
            tipo: 'receita',
            descricao: descricaoLancamento,
            valor: valorPagoSessao,
            cliente_id: clientePagamento.id,
            empresa: clientePagamento.empresa || 'jota_esportivo',
            data_lancamento: dataPagamentoInput,
            status: 'pago',
            data_pagamento: dataPagamentoInput,
            cobranca_id: cobrancaSalva.id,
            criado_por: currentUserId || null
          })
          .select('*, categoria:categorias_financeiro(nome, cor), cliente:clientes(id, nome, empresa)')
          .single()

        if (!lancamentoErr && lancamentoData && onLancamentoCreated) {
          onLancamentoCreated(lancamentoData as any)
        }
      }

      toast.success(
        novoStatusCobranca === 'pago'
          ? `Pagamento integral de ${formatCurrency(valorPagoSessao)} registrado com sucesso!`
          : `Pagamento parcial de ${formatCurrency(valorPagoSessao)} registrado! Saldo restante: ${formatCurrency(Math.max(0, valorMensal - totalPagoAcumulado))}`
      )

      setModalPagamentoAberto(false)
    } catch (err: any) {
      console.error('Erro ao registrar pagamento:', err)
      toast.error(err.message || 'Erro ao registrar pagamento.')
    } finally {
      setSavingPagamento(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alerta de Contratos que Encerram Neste Mês */}
      {contratosAcabandoNoMes.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-amber-400 text-sm">
                  Atenção: {contratosAcabandoNoMes.length} {contratosAcabandoNoMes.length === 1 ? 'contrato se encerra' : 'contratos se encerram'} em {mesReferenciaLabel}!
                </h4>
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full">
                  Ação Comercial Necessária
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Clientes cujo prazo de vigência expira neste mês. Se não houver renovação, a receita deixará de ser contabilizada no mês seguinte:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {contratosAcabandoNoMes.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 bg-surface/80 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs"
                  >
                    <span className="font-semibold text-text-primary">{c.nome}</span>
                    <span className="font-mono text-amber-400 font-bold">{formatCurrency(c.valor_contrato || 0)}/mês</span>
                    <button
                      onClick={() => abrirEdicao(c)}
                      className="text-[10px] text-gold underline hover:text-white ml-1 font-medium"
                    >
                      Renovar Contrato
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navegação entre Sub-abas */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('mensalidades')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'mensalidades'
                ? 'bg-gold text-black shadow-gold-glow'
                : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            <Receipt size={14} />
            <span>Mensalidades & Cobranças do Mês</span>
          </button>
          <button
            onClick={() => setActiveSubTab('contratos')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'contratos'
                ? 'bg-gold text-black shadow-gold-glow'
                : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            <Users size={14} />
            <span>Vigência & Contratos de Clientes</span>
          </button>
        </div>

        {/* Seletor de Mês de Referência */}
        {activeSubTab === 'mensalidades' && (
          <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-lg">
            <button
              onClick={() => navegarMes(-1)}
              className="p-1 rounded hover:bg-surface-elevated text-text-secondary hover:text-text-primary"
              title="Mês Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary px-2 min-w-[150px] justify-center">
              <Calendar size={13} className="text-gold" />
              <span>{mesReferenciaLabel}</span>
            </div>
            <button
              onClick={() => navegarMes(1)}
              className="p-1 rounded hover:bg-surface-elevated text-text-secondary hover:text-text-primary"
              title="Próximo Mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {activeSubTab === 'mensalidades' ? (
        /* ══════════════════════════════════════════════════════════════
           SUB-ABA 1: MENSALIDADES E COBRANÇAS DO MÊS (PAGO / PARCIAL)
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Cards de Resumo do Mês Selecionado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Previsto */}
            <div className="card border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Faturamento Previsto</span>
                <DollarSign size={16} className="text-text-secondary" />
              </div>
              <p className="kpi-number text-text-primary mt-2">{formatCurrency(metricasDoMes.faturamentoPrevisto)}</p>
              <p className="text-[10px] text-text-secondary mt-1">{clientesVigentesNoMes.length} contratos vigentes em {mesReferenciaLabel}</p>
            </div>

            {/* Recebido (Pago) */}
            <div className="card border-success/30 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-success uppercase tracking-wider">Total Recebido</span>
                <CheckCircle size={16} className="text-success" />
              </div>
              <p className="kpi-number text-success mt-2">{formatCurrency(metricasDoMes.faturamentoRecebido)}</p>
              <p className="text-[10px] text-text-secondary mt-1">
                {metricasDoMes.totalPagos} quitados • {metricasDoMes.totalParciais} parciais
              </p>
            </div>

            {/* Pendente / A Receber */}
            <div className="card border-gold/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Pendente a Receber</span>
                <Clock size={16} className="text-gold" />
              </div>
              <p className="kpi-number text-gold mt-2">{formatCurrency(metricasDoMes.faturamentoPendente)}</p>
              <p className="text-[10px] text-text-secondary mt-1">Saldo em aberto a ser liquidado</p>
            </div>

            {/* Atrasado */}
            <div className="card border-danger/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-danger uppercase tracking-wider">Em Atraso</span>
                <AlertTriangle size={16} className="text-danger" />
              </div>
              <p className="kpi-number text-danger mt-2">{formatCurrency(metricasDoMes.faturamentoAtrasado)}</p>
              <p className="text-[10px] text-danger/80 mt-1">{metricasDoMes.totalAtrasados} clientes com vencimento expirado</p>
            </div>
          </div>

          {/* Tabela de Mensalidades do Mês */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-surface-elevated flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-bold text-text-primary">
                  Status de Pagamento dos Clientes — {mesReferenciaLabel}
                </h3>
                <p className="text-xs text-text-secondary">
                  Controle de pagamento integral ou parcial com geração automática de receita no fluxo de caixa
                </p>
              </div>

              {/* Busca */}
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={13} />
                <input
                  type="text"
                  placeholder="Filtrar por cliente..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="input pl-8 py-1.5 text-xs w-full"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Empresa</th>
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Vencimento</th>
                    <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Valor Contrato</th>
                    <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Valor Pago</th>
                    <th className="text-center px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientesVigentesNoMes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-text-secondary italic">
                        Nenhum contrato ativo vigente encontrado para o mês de {mesReferenciaLabel}.
                      </td>
                    </tr>
                  ) : (
                    clientesVigentesNoMes.map(cliente => {
                      const cobranca = cobrancasDoMes.find(c => c.cliente_id === cliente.id)
                      const valorMensal = cliente.valor_contrato || 0
                      const valorPago = cobranca ? Number(cobranca.valor_pago || 0) : 0
                      const saldoRestante = Math.max(0, valorMensal - valorPago)

                      const diaVenc = cliente.dia_vencimento || 10
                      const dataVencStr = `${String(diaVenc).padStart(2, '0')}/${String(dataReferencia.getMonth() + 1).padStart(2, '0')}/${dataReferencia.getFullYear()}`
                      
                      const hojeStr = new Date().toISOString().slice(0, 10)
                      const dataVencIso = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), diaVenc).toISOString().slice(0, 10)
                      
                      const isQuitado = valorPago >= valorMensal
                      const isParcial = valorPago > 0 && valorPago < valorMensal
                      const isAtrasado = !isQuitado && !isParcial && dataVencIso < hojeStr

                      const acabaNesteMes = contratosAcabandoNoMes.some(c => c.id === cliente.id)
                      const emp = cliente.empresa || 'jota_esportivo'

                      return (
                        <tr key={cliente.id} className="hover:bg-surface-elevated/40 transition-colors">
                          {/* Cliente */}
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-primary text-sm">{cliente.nome}</span>
                                {acabaNesteMes && (
                                  <span className="badge border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[9px] font-bold">
                                    ⚠️ Acaba este mês!
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-text-secondary">
                                Vigência: {cliente.data_inicio_contrato ? new Date(cliente.data_inicio_contrato).toLocaleDateString('pt-BR') : 'Início'} 
                                {' até '} 
                                {cliente.data_fim_contrato ? new Date(cliente.data_fim_contrato).toLocaleDateString('pt-BR') : 'Contínuo'}
                              </span>
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

                          {/* Vencimento */}
                          <td className="px-5 py-3.5 font-mono text-text-secondary text-xs">
                            {dataVencStr}
                          </td>

                          {/* Valor Contrato */}
                          <td className="px-5 py-3.5 text-right font-display font-bold tabular-nums text-sm text-text-primary">
                            {formatCurrency(valorMensal)}
                          </td>

                          {/* Valor Pago */}
                          <td className="px-5 py-3.5 text-right font-display font-bold tabular-nums text-sm">
                            <div className="flex flex-col items-end">
                              <span className={valorPago > 0 ? 'text-success' : 'text-text-secondary'}>
                                {formatCurrency(valorPago)}
                              </span>
                              {isParcial && (
                                <span className="text-[10px] text-amber-400 font-normal">
                                  Restam {formatCurrency(saldoRestante)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-5 py-3.5 text-center">
                            {isQuitado && (
                              <span className="badge-success text-[10px] font-bold inline-flex items-center gap-1">
                                <Check size={10} />
                                <span>Pago Integral</span>
                              </span>
                            )}
                            {isParcial && (
                              <span className="badge border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-bold inline-flex items-center gap-1">
                                <span>Pago Parcial</span>
                              </span>
                            )}
                            {isAtrasado && (
                              <span className="badge-danger text-[10px] font-bold inline-flex items-center gap-1">
                                <AlertTriangle size={10} />
                                <span>Atrasado</span>
                              </span>
                            )}
                            {!isQuitado && !isParcial && !isAtrasado && (
                              <span className="badge border border-border bg-surface text-text-secondary text-[10px] font-bold inline-flex items-center gap-1">
                                <Clock size={10} />
                                <span>Pendente</span>
                              </span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => abrirModalPagamento(cliente)}
                              className={`text-xs py-1.5 px-3 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-all ${
                                isQuitado
                                  ? 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                                  : 'bg-gold text-black shadow-gold-glow hover:bg-gold/90 font-bold'
                              }`}
                            >
                              <CreditCard size={12} />
                              <span>{isQuitado ? 'Ver Pagamento' : 'Dar Baixa'}</span>
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
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
           SUB-ABA 2: VIGÊNCIA GERAL DE CONTRATOS & CLIENTES
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Barra de Filtros */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-surface border border-border p-4 rounded-xl">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
              </div>
            </div>
          </div>

          {/* Tabela de Contratos */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-surface-elevated flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-text-primary">Cadastro Geral de Contratos e Vigência</h3>
                <p className="text-xs text-text-secondary">Definição de datas de início e término de contrato e dia de vencimento</p>
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
                    <th className="text-left px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Vigência do Contrato</th>
                    <th className="text-center px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Dia Vencimento</th>
                    <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Valor Mensal</th>
                    <th className="text-right px-5 py-3.5 text-text-secondary font-medium uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientesFiltrados.map(c => {
                    const emp = c.empresa || 'jota_esportivo'
                    return (
                      <tr key={c.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-text-primary text-sm">{c.nome}</span>
                            <span className="text-[10px] text-text-secondary">{c.segmento || 'Sem segmento'}</span>
                          </div>
                        </td>

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

                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span className="text-text-primary font-medium">
                              {c.data_inicio_contrato ? new Date(c.data_inicio_contrato).toLocaleDateString('pt-BR') : 'Sem data início'}
                              {' → '}
                              {c.data_fim_contrato ? new Date(c.data_fim_contrato).toLocaleDateString('pt-BR') : 'Contínuo / Indeterminado'}
                            </span>
                            {c.data_fim_contrato && (
                              <span className="text-[10px] text-amber-400">
                                Encerra em {new Date(c.data_fim_contrato).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-center font-mono font-bold text-text-primary">
                          Todo dia {c.dia_vencimento || 10}
                        </td>

                        <td className="px-5 py-3.5 text-right font-display font-bold tabular-nums text-sm">
                          {c.valor_contrato ? (
                            <span className={c.status === 'ativo' ? 'text-success' : 'text-text-secondary'}>
                              {formatCurrency(c.valor_contrato)}/mês
                            </span>
                          ) : (
                            <span className="text-text-secondary/50 font-normal">Sob demanda</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => abrirEdicao(c)}
                            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                          >
                            <Edit2 size={12} />
                            <span>Gerenciar Vigência</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: DAR BAIXA / REGISTRAR PAGAMENTO (INTEGRAL OU PARCIAL)
          ══════════════════════════════════════════════════════════════ */}
      {modalPagamentoAberto && clientePagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-md rounded-xl overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
              <div>
                <h3 className="font-display text-base font-bold text-text-primary">Registrar Pagamento</h3>
                <p className="text-xs text-gold font-medium">{clientePagamento.nome} • {mesReferenciaLabel}</p>
              </div>
              <button
                onClick={() => setModalPagamentoAberto(false)}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarPagamento} className="p-6 space-y-4">
              {/* Resumo do Contrato */}
              <div className="bg-surface-elevated p-3 rounded-lg border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="text-text-secondary block">Valor da Mensalidade</span>
                  <span className="font-display text-sm font-bold text-text-primary">
                    {formatCurrency(clientePagamento.valor_contrato || 0)}
                  </span>
                </div>
                {cobrancaPagamento && Number(cobrancaPagamento.valor_pago || 0) > 0 && (
                  <div className="text-right">
                    <span className="text-text-secondary block">Já Pago Anteriormente</span>
                    <span className="font-display text-sm font-bold text-success">
                      {formatCurrency(Number(cobrancaPagamento.valor_pago))}
                    </span>
                  </div>
                )}
              </div>

              {/* Tipo de Pagamento: Integral vs Parcial */}
              <div>
                <label className="label mb-1.5">Tipo de Baixa</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoPagamento('integral')
                      const valorMensal = clientePagamento.valor_contrato || 0
                      const jaPago = cobrancaPagamento ? Number(cobrancaPagamento.valor_pago || 0) : 0
                      setValorPagoInput(Math.max(0, valorMensal - jaPago).toString())
                    }}
                    className={`py-2 px-3 text-center rounded-lg border text-xs font-semibold transition-all ${
                      tipoPagamento === 'integral'
                        ? 'border-gold bg-gold text-black font-bold shadow-gold-glow'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    Pagamento Integral
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoPagamento('parcial')}
                    className={`py-2 px-3 text-center rounded-lg border text-xs font-semibold transition-all ${
                      tipoPagamento === 'parcial'
                        ? 'border-amber-500 bg-amber-500/20 text-amber-400 font-bold'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    Pagamento Parcial
                  </button>
                </div>
              </div>

              {/* Valor do Pagamento */}
              <div>
                <label className="label mb-1">
                  {tipoPagamento === 'integral' ? 'Valor a Quitar (R$)' : 'Valor Pago Parcialmente (R$)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-mono text-sm">R$</span>
                  <input
                    type="text"
                    required
                    value={valorPagoInput}
                    onChange={e => setValorPagoInput(e.target.value)}
                    className="input pl-10 font-display text-base font-bold tabular-nums"
                  />
                </div>
                {tipoPagamento === 'parcial' && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    Saldo restante: {formatCurrency(Math.max(0, (clientePagamento.valor_contrato || 0) - (cobrancaPagamento ? Number(cobrancaPagamento.valor_pago || 0) : 0) - (parseFloat(valorPagoInput.replace(',', '.')) || 0)))}
                  </p>
                )}
              </div>

              {/* Data do Pagamento & Forma */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">Data do Pagamento *</label>
                  <input
                    type="date"
                    required
                    value={dataPagamentoInput}
                    onChange={e => setDataPagamentoInput(e.target.value)}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label mb-1">Forma de Pagamento</label>
                  <select
                    value={formaPagamentoInput}
                    onChange={e => setFormaPagamentoInput(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="TED">Transferência</option>
                    <option value="Cartao">Cartão de Crédito</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>

              {/* Checkbox de Conciliação com Fluxo de Caixa */}
              <div className="p-3 bg-surface-elevated rounded-lg border border-border">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={lancarNoCaixa}
                    onChange={e => setLancarNoCaixa(e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-text-primary font-medium">
                    Lançar automaticamente como receita no fluxo de caixa
                  </span>
                </label>
                <p className="text-[10px] text-text-secondary mt-1 pl-6">
                  Cria um lançamento contábil de receita para atualizar imediatamente o saldo bancário e relatórios.
                </p>
              </div>

              {/* Observações */}
              <div>
                <label className="label mb-1">Observações (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Pagou metade hoje via PIX, restante até dia 20"
                  value={observacaoPagamento}
                  onChange={e => setObservacaoPagamento(e.target.value)}
                  className="input text-xs"
                />
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalPagamentoAberto(false)}
                  disabled={savingPagamento}
                  className="btn-ghost text-xs py-2 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPagamento}
                  className="btn-primary text-xs py-2 px-5"
                >
                  {savingPagamento ? 'Registrando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: GERENCIAR CONTRATO & VIGÊNCIA
          ══════════════════════════════════════════════════════════════ */}
      {clienteEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
              <div>
                <h3 className="font-display text-base font-bold text-text-primary">Gerenciar Contrato & Vigência</h3>
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

              {/* Status e Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">Status da Conta *</label>
                  <select
                    value={novoStatus}
                    onChange={e => setNovoStatus(e.target.value as any)}
                    className="input text-xs"
                  >
                    <option value="ativo">Ativo (Contrato Vigente)</option>
                    <option value="prospecto">Prospecto (Em Negociação)</option>
                    <option value="inativo">Inativo (Encerrado)</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1">Valor Mensal (R$) *</label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={novoValorContrato}
                    onChange={e => setNovoValorContrato(e.target.value)}
                    className="input font-display text-sm font-bold tabular-nums"
                  />
                </div>
              </div>

              {/* Vigência do Contrato (Início e Fim) */}
              <div className="p-3 bg-surface-elevated rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary">Período de Vigência</span>
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contratoContinuo}
                      onChange={e => setContratoContinuo(e.target.checked)}
                      className="checkbox"
                    />
                    <span>Contrato Contínuo / Indeterminado</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1">Início da Vigência</label>
                    <input
                      type="date"
                      value={novaDataInicio}
                      onChange={e => setNovaDataInicio(e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="label mb-1">Término da Vigência</label>
                    <input
                      type="date"
                      disabled={contratoContinuo}
                      value={novaDataFim}
                      onChange={e => setNovaDataFim(e.target.value)}
                      className={`input text-xs ${contratoContinuo ? 'opacity-40 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
                {!contratoContinuo && novaDataFim && (
                  <p className="text-[10px] text-amber-400">
                    A previsão financeira considerará este contrato apenas até {new Date(novaDataFim).toLocaleDateString('pt-BR')}.
                  </p>
                )}
              </div>

              {/* Dia de Vencimento e Forma de Pagamento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">Dia do Vencimento</label>
                  <select
                    value={novoDiaVencimento}
                    onChange={e => setNovoDiaVencimento(Number(e.target.value))}
                    className="input text-xs"
                  >
                    {[1, 5, 10, 15, 20, 25, 28, 30].map(dia => (
                      <option key={dia} value={dia}>Todo dia {dia}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1">Forma de Cobrança</label>
                  <select
                    value={novaFormaPagamento}
                    onChange={e => setNovaFormaPagamento(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="TED">Transferência</option>
                    <option value="Cartao">Cartão de Crédito</option>
                  </select>
                </div>
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setClienteEditando(null)}
                  disabled={savingContrato}
                  className="btn-ghost text-xs py-2 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingContrato}
                  className="btn-primary text-xs py-2 px-5"
                >
                  {savingContrato ? 'Salvando...' : 'Salvar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
