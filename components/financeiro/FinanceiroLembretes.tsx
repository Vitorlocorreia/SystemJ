'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle,
  Calendar,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Filter,
  Plus,
  Copy,
  Check,
  Building2,
  Trash2,
  ExternalLink,
  Info
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Lancamento, Cliente, Cobranca, EmpresaGrupo } from '@/types'

export interface ItemVencimento {
  id: string
  origem: 'cobranca_contrato' | 'lancamento'
  tipo: 'receita' | 'despesa'
  descricao: string
  valor: number
  empresa: string
  dataVencimento: string // YYYY-MM-DD
  statusPrazo: 'atrasado' | 'hoje' | 'proximo' | 'no_mes' | 'futuro' | 'pago'
  statusOriginal: 'pago' | 'pendente' | 'parcial' | 'cancelado' | 'atrasado' | string
  diasDiferenca: number // negativo = atrasado, 0 = hoje, positivo = dias restantes
  clienteId?: string
  clienteNome?: string
  clienteTelefone?: string
  projetoNome?: string
  categoriaNome?: string
  categoriaCor?: string
  dataPagamento?: string | null
  rawLancamento?: Lancamento
  rawCobranca?: Cobranca
  rawCliente?: Cliente
}

interface FinanceiroLembretesProps {
  lancamentos: Lancamento[]
  clientes: Cliente[]
  cobrancas: Cobranca[]
  filtroEmpresaGlobal: string
  currentUserId?: string
  isVisualizador?: boolean
  onlyEmpresa?: 'jota_esportivo'
  onLancamentoUpdated?: (l: Lancamento) => void
  onLancamentoDeleted?: (id: string) => void
  onCobrancaUpdated?: (c: Cobranca) => void
  onAbrirNovoLancamento?: (tipo: 'receita' | 'despesa', status: 'pendente') => void
}

export default function FinanceiroLembretes({
  lancamentos,
  clientes,
  cobrancas,
  filtroEmpresaGlobal,
  currentUserId,
  isVisualizador = false,
  onlyEmpresa,
  onLancamentoUpdated,
  onLancamentoDeleted,
  onCobrancaUpdated,
  onAbrirNovoLancamento
}: FinanceiroLembretesProps) {
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [situacaoFiltro, setSituacaoFiltro] = useState<'todos_pendentes' | 'atrasados' | 'hoje' | 'proximos_7' | 'este_mes' | 'pagos'>('todos_pendentes')
  const [searchTerm, setSearchTerm] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState<'todos' | 'jota_esportivo' | 'jota_tech' | 'holding'>(
    onlyEmpresa ? 'jota_esportivo' : (filtroEmpresaGlobal as any) || 'todos'
  )
  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  // Data atual de referência
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

  // ─── CONSOLIDAÇÃO DE CONTAS A PAGAR E A RECEBER ──────────────────────────────
  const itensVencimento = useMemo(() => {
    const lista: ItemVencimento[] = []

    function calcularPrazo(dataVencStr: string, isPago: boolean): { statusPrazo: ItemVencimento['statusPrazo']; diasDiferenca: number } {
      if (isPago) return { statusPrazo: 'pago', diasDiferenca: 0 }
      if (!dataVencStr) return { statusPrazo: 'no_mes', diasDiferenca: 0 }

      const [y, m, d] = dataVencStr.split('-').map(Number)
      const dataVenc = new Date(y, m - 1, d)
      const dataHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      const diffTime = dataVenc.getTime() - dataHoje.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) return { statusPrazo: 'atrasado', diasDiferenca: diffDays }
      if (diffDays === 0) return { statusPrazo: 'hoje', diasDiferenca: 0 }
      if (diffDays <= 7) return { statusPrazo: 'proximo', diasDiferenca: diffDays }
      if (y === currentYear && (m - 1) === currentMonth) return { statusPrazo: 'no_mes', diasDiferenca: diffDays }
      return { statusPrazo: 'futuro', diasDiferenca: diffDays }
    }

    // 1. Mensalidades de Contratos de Clientes (Contas a Receber)
    const clientesAtivos = clientes.filter(c => c.status === 'ativo' && Number(c.valor_contrato) > 0)

    clientesAtivos.forEach(c => {
      // Procura cobrança registrada para este cliente no mês corrente
      const cobrancaMes = cobrancas.find(cb => {
        if (cb.cliente_id !== c.id) return false
        const ref = cb.mes_referencia || cb.data_vencimento
        return ref && ref.startsWith(currentMonthKey)
      })

      const diaVenc = c.dia_vencimento || 10
      const diaVencPad = String(Math.min(diaVenc, 28)).padStart(2, '0')
      const dataVenc = cobrancaMes?.data_vencimento || `${currentMonthKey}-${diaVencPad}`

      const isPago = cobrancaMes?.status === 'pago'
      const valorTotal = Number(c.valor_contrato || 0)
      const valorPago = Number(cobrancaMes?.valor_pago || 0)
      const valorRestante = isPago ? 0 : Math.max(0, valorTotal - valorPago)

      const { statusPrazo, diasDiferenca } = calcularPrazo(dataVenc, isPago)

      lista.push({
        id: cobrancaMes?.id ? `cobranca-${cobrancaMes.id}` : `contrato-${c.id}-${currentMonthKey}`,
        origem: 'cobranca_contrato',
        tipo: 'receita',
        descricao: `Mensalidade ${c.nome}`,
        valor: isPago ? valorTotal : (valorRestante > 0 ? valorRestante : valorTotal),
        empresa: c.empresa || 'jota_esportivo',
        dataVencimento: dataVenc,
        statusPrazo,
        statusOriginal: cobrancaMes ? cobrancaMes.status : 'pendente',
        diasDiferenca,
        clienteId: c.id,
        clienteNome: c.nome,
        clienteTelefone: c.telefone || undefined,
        categoriaNome: 'Contrato Recorrente',
        categoriaCor: '#D4AF37',
        dataPagamento: cobrancaMes?.data_pagamento,
        rawCobranca: cobrancaMes,
        rawCliente: c
      })
    })

    // 2. Lançamentos Registrados (Despesas & Receitas Avulsas)
    lancamentos.forEach(l => {
      // Ignorar lançamentos que já são espelho de cobranças para evitar duplicidade
      if (l.cobranca_id && lista.some(item => item.rawCobranca?.id === l.cobranca_id)) {
        return
      }

      const dataVenc = l.data_vencimento || l.data_lancamento
      const isPago = l.status === 'pago' || (!l.status && !l.data_vencimento)
      const { statusPrazo, diasDiferenca } = calcularPrazo(dataVenc, isPago)

      lista.push({
        id: `lancamento-${l.id}`,
        origem: 'lancamento',
        tipo: l.tipo,
        descricao: l.descricao,
        valor: Number(l.valor || 0),
        empresa: (l.empresa as string) || 'jota_esportivo',
        dataVencimento: dataVenc,
        statusPrazo,
        statusOriginal: (l.status as any) || (isPago ? 'pago' : 'pendente'),
        diasDiferenca,
        clienteId: l.cliente_id || undefined,
        clienteNome: l.cliente?.nome,
        projetoNome: l.projeto?.nome,
        categoriaNome: l.categoria?.nome || 'Geral',
        categoriaCor: l.categoria?.cor || '#64748b',
        dataPagamento: l.data_pagamento || (isPago ? l.data_lancamento : null),
        rawLancamento: l
      })
    })

    return lista
  }, [clientes, cobrancas, lancamentos, currentMonthKey, currentYear, currentMonth, now])

  // ─── FILTRAGEM POR EMPRESA, BUSCA E STATUS ──────────────────────────────────
  const itensFiltrados = useMemo(() => {
    return itensVencimento.filter(item => {
      // Filtro de Empresa
      const emp = item.empresa || 'jota_esportivo'
      if (empresaFiltro !== 'todos' && emp !== empresaFiltro) return false

      // Filtro de Tipo (Receita vs Despesa)
      if (tipoFiltro !== 'todos' && item.tipo !== tipoFiltro) return false

      // Filtro de Situação / Prazo
      if (situacaoFiltro === 'todos_pendentes') {
        if (item.statusPrazo === 'pago') return false
      } else if (situacaoFiltro === 'atrasados') {
        if (item.statusPrazo !== 'atrasado') return false
      } else if (situacaoFiltro === 'hoje') {
        if (item.statusPrazo !== 'hoje') return false
      } else if (situacaoFiltro === 'proximos_7') {
        if (item.statusPrazo !== 'proximo' && item.statusPrazo !== 'hoje') return false
      } else if (situacaoFiltro === 'este_mes') {
        if (item.statusPrazo === 'pago') return false
        if (!item.dataVencimento.startsWith(currentMonthKey)) return false
      } else if (situacaoFiltro === 'pagos') {
        if (item.statusPrazo !== 'pago') return false
      }

      // Filtro de Busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchDesc = item.descricao.toLowerCase().includes(term)
        const matchCliente = item.clienteNome ? item.clienteNome.toLowerCase().includes(term) : false
        const matchProjeto = item.projetoNome ? item.projetoNome.toLowerCase().includes(term) : false
        const matchCat = item.categoriaNome ? item.categoriaNome.toLowerCase().includes(term) : false
        if (!matchDesc && !matchCliente && !matchProjeto && !matchCat) return false
      }

      return true
    }).sort((a, b) => {
      // Ordenação prioritária:
      // 1. Atrasados primeiro
      // 2. Vencendo hoje
      // 3. Próximos
      // 4. Data de vencimento crescente para pendentes
      const priorityMap: Record<string, number> = {
        atrasado: 1,
        hoje: 2,
        proximo: 3,
        no_mes: 4,
        futuro: 5,
        pago: 6
      }

      const pA = priorityMap[a.statusPrazo] || 99
      const pB = priorityMap[b.statusPrazo] || 99

      if (pA !== pB) return pA - pB
      return a.dataVencimento.localeCompare(b.dataVencimento)
    })
  }, [itensVencimento, empresaFiltro, tipoFiltro, situacaoFiltro, searchTerm, currentMonthKey])

  // ─── MÉTRICAS / KPIS DO RADAR DE VENCIMENTOS ──────────────────────────────
  const kpis = useMemo(() => {
    // Base filtrada apenas por empresa
    const base = itensVencimento.filter(item => {
      const emp = item.empresa || 'jota_esportivo'
      return empresaFiltro === 'todos' || emp === empresaFiltro
    })

    const pendentes = base.filter(i => i.statusPrazo !== 'pago')
    const atrasadas = pendentes.filter(i => i.statusPrazo === 'atrasado')
    const hoje = pendentes.filter(i => i.statusPrazo === 'hoje')
    const proximos7 = pendentes.filter(i => i.statusPrazo === 'proximo' || i.statusPrazo === 'hoje')

    const totalAtrasado = atrasadas.reduce((s, i) => s + i.valor, 0)
    const totalHoje = hoje.reduce((s, i) => s + i.valor, 0)
    const totalProximos7 = proximos7.reduce((s, i) => s + i.valor, 0)

    const totalAPagar = pendentes.filter(i => i.tipo === 'despesa').reduce((s, i) => s + i.valor, 0)
    const totalAReceber = pendentes.filter(i => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0)
    const saldoProjetado = totalAReceber - totalAPagar

    const qtdAPagar = pendentes.filter(i => i.tipo === 'despesa').length
    const qtdAReceber = pendentes.filter(i => i.tipo === 'receita').length

    return {
      qtdAtrasadas: atrasadas.length,
      totalAtrasado,
      qtdHoje: hoje.length,
      totalHoje,
      qtdProximos7: proximos7.length,
      totalProximos7,
      totalAPagar,
      qtdAPagar,
      totalAReceber,
      qtdAReceber,
      saldoProjetado
    }
  }, [itensVencimento, empresaFiltro])

  // ─── AÇÃO: DAR BAIXA / MARCAR COMO PAGO ──────────────────────────────────
  async function handleDarBaixa(item: ItemVencimento) {
    if (isVisualizador) {
      toast.error('Você tem permissão apenas de visualização no financeiro.')
      return
    }

    if (!confirm(`Confirmar liquidação e dar baixa em "${item.descricao}" no valor de ${formatCurrency(item.valor)}?`)) {
      return
    }

    setProcessandoId(item.id)
    const supabase = createClient() as any

    try {
      if (item.origem === 'lancamento' && item.rawLancamento) {
        // Atualizar lançamento para pago
        const { data, error } = await supabase
          .from('lancamentos')
          .update({
            status: 'pago',
            data_pagamento: todayStr
          })
          .eq('id', item.rawLancamento.id)
          .select('*, categoria:categorias_financeiro(nome, cor), cliente:clientes(id, nome), projeto:projetos(id, nome)')
          .single()

        if (error) throw error
        toast.success(`Baixa efetuada com sucesso: ${item.descricao}`)
        if (onLancamentoUpdated) onLancamentoUpdated(data)
      } else if (item.origem === 'cobranca_contrato' && item.rawCliente) {
        // Atualizar ou inserir cobrança de mensalidade como paga
        const cliente = item.rawCliente
        const mesRefKey = `${item.dataVencimento.slice(0, 7)}-01`

        if (item.rawCobranca) {
          const { data, error } = await supabase
            .from('cobrancas')
            .update({
              status: 'pago',
              valor_pago: item.valor,
              data_pagamento: new Date().toISOString()
            })
            .eq('id', item.rawCobranca.id)
            .select('*')
            .single()

          if (error) throw error
          toast.success(`Mensalidade de ${cliente.nome} marcada como paga!`)
          if (onCobrancaUpdated) onCobrancaUpdated(data)
        } else {
          // Criar registro de cobrança paga
          const { data, error } = await supabase
            .from('cobrancas')
            .insert({
              cliente_id: cliente.id,
              empresa: cliente.empresa || 'jota_esportivo',
              mes_referencia: mesRefKey,
              valor_total: item.valor,
              valor_pago: item.valor,
              status: 'pago',
              data_vencimento: item.dataVencimento,
              data_pagamento: new Date().toISOString(),
              observacao: 'Liquidado via painel de lembretes rápidos'
            })
            .select('*')
            .single()

          if (error) throw error
          toast.success(`Cobrança de ${cliente.nome} registrada e quitada!`)
          if (onCobrancaUpdated) onCobrancaUpdated(data)
        }
      }
    } catch (err: any) {
      console.error('Erro ao dar baixa:', err)
      toast.error('Erro ao dar baixa: ' + (err.message || 'Falha na operação.'))
    } finally {
      setProcessandoId(null)
    }
  }

  // ─── AÇÃO: EXCLUIR CONTA A PAGAR/RECEBER PENDENTE ──────────────────────────
  async function handleExcluir(item: ItemVencimento) {
    if (isVisualizador) {
      toast.error('Você tem permissão apenas de visualização.')
      return
    }

    if (!confirm(`Deseja realmente remover o lançamento "${item.descricao}"?`)) {
      return
    }

    if (item.origem === 'lancamento' && item.rawLancamento) {
      const supabase = createClient()
      const { error } = await supabase.from('lancamentos').delete().eq('id', item.rawLancamento.id)
      if (error) {
        toast.error('Erro ao excluir: ' + error.message)
      } else {
        toast.success('Lançamento removido com sucesso!')
        if (onLancamentoDeleted) onLancamentoDeleted(item.rawLancamento.id)
      }
    } else {
      toast.info('Para alterar mensalidades contratuais, utilize a aba Contratos.')
    }
  }

  // ─── AÇÃO: COPIAR LEMBRETE PARA WHATSAPP ──────────────────────────────────
  function handleCopiarWhatsApp(item: ItemVencimento) {
    const nomeCliente = item.clienteNome || 'Cliente'
    const valorStr = formatCurrency(item.valor)
    const [y, m, d] = item.dataVencimento.split('-')
    const vencFormatado = `${d}/${m}/${y}`

    let msg = ''
    if (item.statusPrazo === 'atrasado') {
      const dias = Math.abs(item.diasDiferenca)
      msg = `Olá, *${nomeCliente}*! Tudo bem?\n\nPassando pelo setor financeiro do *Grupo Jota*, identificamos a mensalidade no valor de *R$ ${valorStr}*, cujo vencimento foi em *${vencFormatado}* (há ${dias} dia${dias > 1 ? 's' : ''}).\n\nCaso já tenha efetuado o pagamento, por favor desconsidere ou nos envie o comprovante. Caso precise da chave PIX ou boleto, estamos à disposição!\n\n_Equipe Financeira Grupo Jota_`
    } else if (item.statusPrazo === 'hoje') {
      msg = `Olá, *${nomeCliente}*! Tudo bem?\n\nLembramos que hoje (*${vencFormatado}*) é a data de vencimento da mensalidade da sua conta no valor de *R$ ${valorStr}* junto ao *Grupo Jota*.\n\nQualquer dúvida ou se precisar de chave PIX/dados bancários, conte conosco!\n\n_Equipe Financeira Grupo Jota_`
    } else {
      msg = `Olá, *${nomeCliente}*! Tudo bem?\n\nLembramos que a sua mensalidade no valor de *R$ ${valorStr}* vence em *${vencFormatado}*.\n\nCaso precise da chave PIX ou de alguma informação, estamos à disposição!\n\n_Equipe Financeira Grupo Jota_`
    }

    navigator.clipboard.writeText(msg)
    setCopiadoId(item.id)
    toast.success('Texto de cobrança copiado! Pode colar diretamente no WhatsApp do cliente.')
    setTimeout(() => setCopiadoId(null), 3000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── BANNER DE RESUMO & ALERTAS ────────────────────────────────────────── */}
      {(kpis.qtdAtrasadas > 0 || kpis.qtdHoje > 0) && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-surface to-amber-500/5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 animate-pulse">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2">
                <span>Atenção Financeira: Contas Exigem Sua Ação</span>
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                {kpis.qtdAtrasadas > 0 && (
                  <span className="text-danger font-semibold">
                    🚨 {kpis.qtdAtrasadas} conta(s) em atraso ({formatCurrency(kpis.totalAtrasado)}){' '}
                  </span>
                )}
                {kpis.qtdAtrasadas > 0 && kpis.qtdHoje > 0 && <span>• </span>}
                {kpis.qtdHoje > 0 && (
                  <span className="text-amber-400 font-semibold">
                    ⚡ {kpis.qtdHoje} conta(s) vencendo hoje ({formatCurrency(kpis.totalHoje)})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {kpis.qtdAtrasadas > 0 && (
              <button
                onClick={() => setSituacaoFiltro('atrasados')}
                className="btn-danger text-xs py-1.5 px-3"
              >
                Ver Apenas Atrasadas ({kpis.qtdAtrasadas})
              </button>
            )}
            {kpis.qtdHoje > 0 && (
              <button
                onClick={() => setSituacaoFiltro('hoje')}
                className="btn-secondary text-xs py-1.5 px-3 text-amber-400 border-amber-500/30"
              >
                Ver Vencem Hoje ({kpis.qtdHoje})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── CARDS DE KPIS / RADAR FINANCEIRO ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Atrasadas */}
        <div
          onClick={() => setSituacaoFiltro('atrasados')}
          className={`card cursor-pointer transition-all hover:scale-[1.02] p-4 ${
            situacaoFiltro === 'atrasados' ? 'border-danger bg-danger/10 shadow-lg' : 'hover:border-danger/40'
          }`}
        >
          <div className="flex items-center justify-between text-danger mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Atrasadas</span>
            <AlertTriangle size={15} />
          </div>
          <p className="font-display text-lg font-bold text-danger tabular-nums">
            {formatCurrency(kpis.totalAtrasado)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            {kpis.qtdAtrasadas} {kpis.qtdAtrasadas === 1 ? 'conta vencida' : 'contas vencidas'}
          </p>
        </div>

        {/* Vence Hoje */}
        <div
          onClick={() => setSituacaoFiltro('hoje')}
          className={`card cursor-pointer transition-all hover:scale-[1.02] p-4 ${
            situacaoFiltro === 'hoje' ? 'border-amber-500 bg-amber-500/10 shadow-lg' : 'hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Vencem Hoje</span>
            <Clock size={15} />
          </div>
          <p className="font-display text-lg font-bold text-amber-400 tabular-nums">
            {formatCurrency(kpis.totalHoje)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            {kpis.qtdHoje} {kpis.qtdHoje === 1 ? 'conta para hoje' : 'contas para hoje'}
          </p>
        </div>

        {/* Próximos 7 Dias */}
        <div
          onClick={() => setSituacaoFiltro('proximos_7')}
          className={`card cursor-pointer transition-all hover:scale-[1.02] p-4 ${
            situacaoFiltro === 'proximos_7' ? 'border-cyan-500 bg-cyan-500/10 shadow-lg' : 'hover:border-cyan-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-cyan-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Próx. 7 Dias</span>
            <Calendar size={15} />
          </div>
          <p className="font-display text-lg font-bold text-cyan-400 tabular-nums">
            {formatCurrency(kpis.totalProximos7)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            {kpis.qtdProximos7} {kpis.qtdProximos7 === 1 ? 'conta prevista' : 'contas previstas'}
          </p>
        </div>

        {/* Total a Pagar Pendente */}
        <div
          onClick={() => { setTipoFiltro('despesa'); setSituacaoFiltro('todos_pendentes') }}
          className={`card cursor-pointer transition-all hover:scale-[1.02] p-4 ${
            tipoFiltro === 'despesa' ? 'border-danger/60 bg-danger/5 shadow-md' : 'hover:border-danger/40'
          }`}
        >
          <div className="flex items-center justify-between text-danger mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">A Pagar</span>
            <ArrowDownRight size={15} />
          </div>
          <p className="font-display text-lg font-bold text-danger tabular-nums">
            {formatCurrency(kpis.totalAPagar)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            {kpis.qtdAPagar} despesas pendentes
          </p>
        </div>

        {/* Total a Receber Pendente */}
        <div
          onClick={() => { setTipoFiltro('receita'); setSituacaoFiltro('todos_pendentes') }}
          className={`card cursor-pointer transition-all hover:scale-[1.02] p-4 ${
            tipoFiltro === 'receita' ? 'border-success/60 bg-success/5 shadow-md' : 'hover:border-success/40'
          }`}
        >
          <div className="flex items-center justify-between text-success mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">A Receber</span>
            <ArrowUpRight size={15} />
          </div>
          <p className="font-display text-lg font-bold text-success tabular-nums">
            {formatCurrency(kpis.totalAReceber)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            {kpis.qtdAReceber} receitas / contratos
          </p>
        </div>

        {/* Saldo Líquido Previsto */}
        <div className="card p-4 border-gold/30 bg-surface">
          <div className="flex items-center justify-between text-gold mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Saldo Líquido</span>
            <DollarSign size={15} />
          </div>
          <p className={`font-display text-lg font-bold tabular-nums ${kpis.saldoProjetado >= 0 ? 'text-gold' : 'text-danger'}`}>
            {formatCurrency(kpis.saldoProjetado)}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            Previsão pendente
          </p>
        </div>
      </div>

      {/* ─── BARRA DE CONTROLES E FILTROS ────────────────────────────────────────── */}
      <div className="bg-surface border border-border p-4 rounded-xl space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Seletor Tipo: Todos / A Pagar / A Receber */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-elevated rounded-lg border border-border overflow-x-auto">
            <button
              onClick={() => setTipoFiltro('todos')}
              className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                tipoFiltro === 'todos'
                  ? 'bg-surface text-text-primary shadow-sm border border-border'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Todos os Vencimentos
            </button>
            <button
              onClick={() => setTipoFiltro('despesa')}
              className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                tipoFiltro === 'despesa'
                  ? 'bg-danger text-white shadow-sm'
                  : 'text-text-secondary hover:text-danger'
              }`}
            >
              <ArrowDownRight size={13} />
              <span>Contas a Pagar (Saídas)</span>
            </button>
            <button
              onClick={() => setTipoFiltro('receita')}
              className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                tipoFiltro === 'receita'
                  ? 'bg-success text-black shadow-sm'
                  : 'text-text-secondary hover:text-success'
              }`}
            >
              <ArrowUpRight size={13} />
              <span>Contas a Receber (Entradas)</span>
            </button>
          </div>

          {/* Botões de Ação para Criar Contas */}
          {!isVisualizador && onAbrirNovoLancamento && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAbrirNovoLancamento('despesa', 'pendente')}
                className="btn-danger flex items-center gap-1.5 text-xs py-2 px-3 shadow-sm"
              >
                <Plus size={14} />
                <span>+ Conta a Pagar</span>
              </button>
              <button
                onClick={() => onAbrirNovoLancamento('receita', 'pendente')}
                className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3 shadow-gold-glow"
              >
                <Plus size={14} />
                <span>+ Conta a Receber</span>
              </button>
            </div>
          )}
        </div>

        {/* Filtros Secundários: Situação/Prazo + Busca + Empresa */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-border/60">
          {/* Abas de Situação / Prazo */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
            <button
              onClick={() => setSituacaoFiltro('todos_pendentes')}
              className={`py-1 px-2.5 rounded-lg border transition-all whitespace-nowrap ${
                situacaoFiltro === 'todos_pendentes'
                  ? 'bg-gold-muted text-gold border-gold/40'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Pendentes ({kpis.qtdAPagar + kpis.qtdAReceber})
            </button>
            <button
              onClick={() => setSituacaoFiltro('atrasados')}
              className={`py-1 px-2.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1 ${
                situacaoFiltro === 'atrasados'
                  ? 'bg-danger/15 text-danger border-danger/40'
                  : 'border-transparent text-text-secondary hover:text-danger'
              }`}
            >
              <span>🚨 Atrasadas</span>
              {kpis.qtdAtrasadas > 0 && (
                <span className="bg-danger text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  {kpis.qtdAtrasadas}
                </span>
              )}
            </button>
            <button
              onClick={() => setSituacaoFiltro('hoje')}
              className={`py-1 px-2.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1 ${
                situacaoFiltro === 'hoje'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                  : 'border-transparent text-text-secondary hover:text-amber-400'
              }`}
            >
              <span>⚡ Vence Hoje</span>
              {kpis.qtdHoje > 0 && (
                <span className="bg-amber-500 text-black text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  {kpis.qtdHoje}
                </span>
              )}
            </button>
            <button
              onClick={() => setSituacaoFiltro('proximos_7')}
              className={`py-1 px-2.5 rounded-lg border transition-all whitespace-nowrap ${
                situacaoFiltro === 'proximos_7'
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40'
                  : 'border-transparent text-text-secondary hover:text-cyan-400'
              }`}
            >
              Próximos 7 Dias
            </button>
            <button
              onClick={() => setSituacaoFiltro('este_mes')}
              className={`py-1 px-2.5 rounded-lg border transition-all whitespace-nowrap ${
                situacaoFiltro === 'este_mes'
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/40'
                  : 'border-transparent text-text-secondary hover:text-purple-400'
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setSituacaoFiltro('pagos')}
              className={`py-1 px-2.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1 ${
                situacaoFiltro === 'pagos'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : 'border-transparent text-text-secondary hover:text-emerald-400'
              }`}
            >
              <CheckCircle size={12} />
              <span>Pagas / Baixadas</span>
            </button>
          </div>

          {/* Campo de Busca */}
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar por cliente, conta ou job..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-8 py-1.5 text-xs w-full"
            />
          </div>
        </div>
      </div>

      {/* ─── TABELA DE CONTAS E LEMBRETES ────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-border bg-surface-elevated flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-gold" />
            <h2 className="font-display text-sm font-bold text-text-primary">
              Contas & Lembretes ({itensFiltrados.length})
            </h2>
          </div>
          <span className="text-xs text-text-secondary">
            Ordenado por urgência de vencimento
          </span>
        </div>

        {itensFiltrados.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            <CheckCircle size={40} className="mx-auto mb-3 opacity-30 text-success" />
            <p className="text-sm font-semibold text-text-primary">Nenhuma conta encontrada com estes filtros.</p>
            <p className="text-xs mt-1 opacity-75">Tudo em dia para o período e situação selecionados!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface text-text-secondary font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Status / Prazo</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Descrição / Vínculo</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {itensFiltrados.map(item => {
                  const isAtrasado = item.statusPrazo === 'atrasado'
                  const isHoje = item.statusPrazo === 'hoje'
                  const isPago = item.statusPrazo === 'pago'

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-surface-elevated transition-colors ${
                        isAtrasado
                          ? 'bg-danger/[0.04]'
                          : isHoje
                          ? 'bg-amber-500/[0.04]'
                          : ''
                      }`}
                    >
                      {/* Status / Prazo */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isPago ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle size={12} />
                            <span>Liquidado</span>
                          </span>
                        ) : isAtrasado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-danger/15 text-danger border border-danger/30 animate-pulse">
                            <AlertTriangle size={12} />
                            <span>Atrasado ({Math.abs(item.diasDiferenca)}d)</span>
                          </span>
                        ) : isHoje ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono">
                            <Clock size={12} />
                            <span>VENCE HOJE</span>
                          </span>
                        ) : item.statusPrazo === 'proximo' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            <Calendar size={12} />
                            <span>Em {item.diasDiferenca} dias</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-surface text-text-secondary border border-border">
                            <Calendar size={12} />
                            <span>No mês</span>
                          </span>
                        )}
                      </td>

                      {/* Tipo: A Pagar vs A Receber */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.tipo === 'despesa' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-danger/15 text-danger">
                            <ArrowDownRight size={11} />
                            <span>A Pagar</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-success/15 text-success">
                            <ArrowUpRight size={11} />
                            <span>A Receber</span>
                          </span>
                        )}
                      </td>

                      {/* Vencimento */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs text-text-primary">
                          {formatDate(item.dataVencimento)}
                        </div>
                        {item.dataPagamento && (
                          <div className="text-[10px] text-text-secondary">
                            Pago em: {formatDate(item.dataPagamento)}
                          </div>
                        )}
                      </td>

                      {/* Descrição e Vínculo */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-text-primary">
                          {item.descricao}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-secondary">
                          {item.clienteNome && (
                            <span className="text-gold font-medium">
                              👤 {item.clienteNome}
                            </span>
                          )}
                          {item.projetoNome && (
                            <span className="text-cyan-400">
                              📁 {item.projetoNome}
                            </span>
                          )}
                          {item.categoriaNome && (
                            <span className="text-text-secondary">
                              🏷️ {item.categoriaNome}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          item.empresa === 'jota_tech'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                            : item.empresa === 'holding'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-gold-muted text-gold border-gold/30'
                        }`}>
                          {item.empresa === 'jota_tech' ? '💻 Jota Tech' : item.empresa === 'holding' ? '🏢 Holding' : '⚽ Jota Esportivo'}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-display text-sm font-bold tabular-nums">
                        <span className={item.tipo === 'despesa' ? 'text-danger' : 'text-success'}>
                          {item.tipo === 'despesa' ? '- ' : '+ '}
                          {formatCurrency(item.valor)}
                        </span>
                      </td>

                      {/* Ações Rápidas */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copiar WhatsApp para Contas a Receber */}
                          {item.tipo === 'receita' && !isPago && (
                            <button
                              onClick={() => handleCopiarWhatsApp(item)}
                              title="Copiar texto de cobrança para WhatsApp"
                              className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              {copiadoId === item.id ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiadoId === item.id ? 'Copiado!' : 'WhatsApp'}</span>
                            </button>
                          )}

                          {/* Dar Baixa / Marcar como Pago */}
                          {!isVisualizador && !isPago && (
                            <button
                              onClick={() => handleDarBaixa(item)}
                              disabled={processandoId === item.id}
                              title="Confirmar pagamento / liquidar"
                              className="btn-primary text-[11px] py-1 px-2.5 flex items-center gap-1 shadow-gold-glow"
                            >
                              <CheckCircle size={12} />
                              <span>{processandoId === item.id ? 'Baixando...' : 'Dar Baixa'}</span>
                            </button>
                          )}

                          {/* Excluir (apenas lançamentos avulsos) */}
                          {!isVisualizador && item.origem === 'lancamento' && (
                            <button
                              onClick={() => handleExcluir(item)}
                              title="Excluir lançamento"
                              className="p-1 rounded text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
