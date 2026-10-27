'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks/useProfile'
import { isMolaProfile, formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Bell,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  X
} from 'lucide-react'

interface NotificacaoItem {
  id: string
  tipo: 'despesa' | 'receita'
  titulo: string
  subtitulo?: string
  valor: number
  dataVencimento: string
  statusPrazo: 'atrasado' | 'hoje' | 'proximo'
  diasDiferenca: number
  empresa: string
  clienteTelefone?: string
  origem: 'lancamento' | 'contrato' | 'cobranca'
}

export default function GestorNotificationBell() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [itens, setItens] = useState<NotificacaoItem[]>([])
  const [filtroAba, setFiltroAba] = useState<'urgentes' | 'proximos' | 'todos'>('urgentes')
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // 1. Verificação Estrita de Gestor
  const nomeLower = profile?.nome?.toLowerCase() || ''
  const isGestor =
    profile?.role === 'owner' ||
    profile?.role === 'gestor_equipe' ||
    profile?.role === 'gestor_financeiro' ||
    nomeLower.includes('mola') ||
    nomeLower.includes('rennan') ||
    nomeLower.includes('renan')

  const isMola = isMolaProfile(profile)

  // Fechar popover ao clicar fora ou apertar Esc
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Buscar notificações
  async function carregarNotificacoes() {
    if (!isGestor) return
    setLoading(true)

    try {
      const supabase = createClient() as any
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

      // Buscar em paralelo: lançamentos pendentes, cobranças pendentes e clientes ativos
      let [
        { data: lancamentos },
        { data: cobrancas },
        { data: clientes }
      ] = await Promise.all([
        supabase
          .from('lancamentos')
          .select('id, tipo, descricao, valor, status, data_vencimento, data_lancamento, empresa, cobranca_id, cliente:clientes(nome)')
          .eq('status', 'pendente'),
        supabase
          .from('cobrancas')
          .select('id, cliente_id, valor_total, valor_pago, status, data_vencimento, mes_referencia, empresa, cliente:clientes(id, nome, telefone, empresa, valor_contrato)')
          .neq('status', 'pago'),
        supabase
          .from('clientes')
          .select('id, nome, telefone, empresa, valor_contrato, dia_vencimento, status')
          .eq('status', 'ativo')
          .gt('valor_contrato', 0)
      ])

      // Se for Mola, filtrar estritamente para dados do Jota Esportivo
      if (isMola) {
        lancamentos = (lancamentos || []).filter((l: any) => (l.empresa || 'jota_esportivo') === 'jota_esportivo')
        cobrancas = (cobrancas || []).filter((c: any) => (c.empresa || c.cliente?.empresa || 'jota_esportivo') === 'jota_esportivo')
        clientes = (clientes || []).filter((cl: any) => (cl.empresa || 'jota_esportivo') === 'jota_esportivo')
      }

      const lista: NotificacaoItem[] = []

      function calcularPrazo(dataVencStr: string): { statusPrazo: NotificacaoItem['statusPrazo']; diasDiferenca: number } {
        if (!dataVencStr) return { statusPrazo: 'proximo', diasDiferenca: 0 }
        const [y, m, d] = dataVencStr.split('-').map(Number)
        const dataVenc = new Date(y, m - 1, d)
        const dataHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const diffDays = Math.ceil((dataVenc.getTime() - dataHoje.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays < 0) return { statusPrazo: 'atrasado', diasDiferenca: diffDays }
        if (diffDays === 0) return { statusPrazo: 'hoje', diasDiferenca: 0 }
        return { statusPrazo: 'proximo', diasDiferenca: diffDays }
      }

      // 1. Mensalidades de Contratos de Clientes Ativos do mês
      ;(clientes || []).forEach((c: any) => {
        const cobrancaMes = (cobrancas || []).find((cb: any) => {
          if (cb.cliente_id !== c.id) return false
          const ref = cb.mes_referencia || cb.data_vencimento
          return ref && ref.startsWith(currentMonthKey)
        })

        const diaVenc = c.dia_vencimento || 10
        const diaVencPad = String(Math.min(diaVenc, 28)).padStart(2, '0')
        const dataVenc = cobrancaMes?.data_vencimento || `${currentMonthKey}-${diaVencPad}`

        const isPago = cobrancaMes?.status === 'pago'
        if (isPago) return

        const valorTotal = Number(c.valor_contrato || 0)
        const valorPago = Number(cobrancaMes?.valor_pago || 0)
        const valorRestante = Math.max(0, valorTotal - valorPago)
        const valorFinal = valorRestante > 0 ? valorRestante : valorTotal

        const { statusPrazo, diasDiferenca } = calcularPrazo(dataVenc)

        // Limitar para notificações relevantes (atrasadas, hoje, ou próximos 7 dias)
        if (diasDiferenca <= 7) {
          lista.push({
            id: cobrancaMes?.id ? `cb-${cobrancaMes.id}` : `ct-${c.id}`,
            tipo: 'receita',
            titulo: `Mensalidade ${c.nome}`,
            subtitulo: `Contrato de cliente • ${c.empresa === 'jota_tech' ? 'Jota Tech' : 'Jota Esportivo'}`,
            valor: valorFinal,
            dataVencimento: dataVenc,
            statusPrazo,
            diasDiferenca,
            empresa: c.empresa || 'jota_esportivo',
            clienteTelefone: c.telefone || undefined,
            origem: cobrancaMes ? 'cobranca' : 'contrato'
          })
        }
      })

      // 2. Lançamentos com status pendente (Despesas e Receitas avulsas)
      ;(lancamentos || []).forEach((l: any) => {
        // Ignorar se já vinculado a uma cobrança processada
        if (l.cobranca_id && lista.some(x => x.id === `cb-${l.cobranca_id}`)) return

        const dataVenc = l.data_vencimento || l.data_lancamento
        const { statusPrazo, diasDiferenca } = calcularPrazo(dataVenc)

        if (diasDiferenca <= 7) {
          lista.push({
            id: `lan-${l.id}`,
            tipo: l.tipo,
            titulo: l.descricao,
            subtitulo: l.cliente?.nome ? `Cliente: ${l.cliente.nome}` : undefined,
            valor: Number(l.valor || 0),
            dataVencimento: dataVenc,
            statusPrazo,
            diasDiferenca,
            empresa: l.empresa || 'jota_esportivo',
            origem: 'lancamento'
          })
        }
      })

      // Ordenar: atrasadas primeiro (mais antigas primeiro), depois hoje, depois próximos dias
      lista.sort((a, b) => {
        const orderMap = { atrasado: 1, hoje: 2, proximo: 3 }
        const prioDiff = orderMap[a.statusPrazo] - orderMap[b.statusPrazo]
        if (prioDiff !== 0) return prioDiff
        return a.dataVencimento.localeCompare(b.dataVencimento)
      })

      setItens(lista)
    } catch (err) {
      console.error('Erro ao carregar notificações do gestor:', err)
    } finally {
      setLoading(false)
    }
  }

  // Carregar ao montar e se isGestor estiver disponível
  useEffect(() => {
    if (isGestor) {
      carregarNotificacoes()
      // Atualizar periodicamente a cada 2 minutos
      const interval = setInterval(carregarNotificacoes, 120000)
      return () => clearInterval(interval)
    }
  }, [isGestor, isMola])

  // Contagens e Filtros
  const urgentes = useMemo(() => itens.filter(i => i.statusPrazo === 'atrasado' || i.statusPrazo === 'hoje'), [itens])
  const proximos = useMemo(() => itens.filter(i => i.statusPrazo === 'proximo'), [itens])

  const itensExibidos = useMemo(() => {
    if (filtroAba === 'urgentes') return urgentes
    if (filtroAba === 'proximos') return proximos
    return itens
  }, [filtroAba, urgentes, proximos, itens])

  const totalUrgente = urgentes.length
  const totalAtrasadas = urgentes.filter(i => i.statusPrazo === 'atrasado').length
  const totalHoje = urgentes.filter(i => i.statusPrazo === 'hoje').length

  // Copiar lembrete WhatsApp para cobrança
  function handleCopiarWhatsApp(item: NotificacaoItem, e: React.MouseEvent) {
    e.stopPropagation()
    const valorStr = formatCurrency(item.valor)
    const [y, m, d] = item.dataVencimento.split('-')
    const vencFormatado = `${d}/${m}/${y}`
    const nomeCliente = item.titulo.replace('Mensalidade ', '')

    let msg = ''
    if (item.statusPrazo === 'atrasado') {
      const dias = Math.abs(item.diasDiferenca)
      msg = `Olá, *${nomeCliente}*! Tudo bem?\n\nPassando pelo setor financeiro do *Grupo Jota*, identificamos a mensalidade no valor de *R$ ${valorStr}*, cujo vencimento foi em *${vencFormatado}* (há ${dias} dia${dias > 1 ? 's' : ''}).\n\nCaso já tenha efetuado o pagamento, por favor nos envie o comprovante. Caso precise da chave PIX, estamos à disposição!\n\n_Equipe Financeira Grupo Jota_`
    } else {
      msg = `Olá, *${nomeCliente}*! Tudo bem?\n\nLembramos que a sua mensalidade no valor de *R$ ${valorStr}* vence em *${vencFormatado}*.\n\nQualquer dúvida ou caso precise da chave PIX, conte conosco!\n\n_Equipe Financeira Grupo Jota_`
    }

    navigator.clipboard.writeText(msg)
    setCopiadoId(item.id)
    toast.success('Mensagem de cobrança copiada para a área de transferência!')
    setTimeout(() => setCopiadoId(null), 3000)
  }

  // Se não for gestor ou perfil estiver carregando, não exibe nada
  if (loadingProfile || !isGestor) {
    return null
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Botão Sininho */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) carregarNotificacoes()
        }}
        aria-label="Notificações de Gestão"
        title={totalUrgente > 0 ? `Existem ${totalUrgente} pendências urgentes para você` : 'Notificações de Gestão'}
        className={`relative p-2 rounded-xl transition-all duration-150 flex items-center justify-center ${
          isOpen
            ? 'bg-surface-elevated text-gold border border-gold/40 shadow-gold-glow'
            : totalUrgente > 0
            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
        }`}
      >
        <Bell
          size={19}
          className={`${
            totalUrgente > 0 ? 'text-amber-400' : ''
          }`}
        />

        {/* Badge Numérico com Efeito Pulsante */}
        {totalUrgente > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-danger text-white text-[9px] font-black leading-none shadow-md">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
            <span className="relative">{totalUrgente > 99 ? '99+' : totalUrgente}</span>
          </span>
        )}
      </button>

      {/* Popover Dropdown de Notificações */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-surface border border-border shadow-2xl z-50 overflow-hidden animate-scale-in">
          {/* Header do Popover */}
          <div className="p-4 border-b border-border bg-surface-elevated flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gold-muted text-gold">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <span>Central de Lembretes</span>
                  {isMola && (
                    <span className="text-[10px] font-normal text-gold bg-gold-muted px-1.5 py-0.2 rounded border border-gold/30">
                      Jota Esportivo
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-text-secondary">
                  {totalUrgente > 0
                    ? `${totalAtrasadas} atrasada(s) • ${totalHoje} vence(m) hoje`
                    : 'Nenhuma pendência urgente no momento'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={carregarNotificacoes}
                disabled={loading}
                title="Atualizar Notificações"
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-gold' : ''} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Abas Rápidas */}
          <div className="flex items-center border-b border-border bg-surface px-3 py-1.5 gap-1 text-xs">
            <button
              onClick={() => setFiltroAba('urgentes')}
              className={`py-1 px-2.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                filtroAba === 'urgentes'
                  ? 'bg-danger/15 text-danger border border-danger/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>🚨 Urgentes</span>
              {urgentes.length > 0 && (
                <span className="bg-danger text-white text-[9px] px-1.5 py-0.2 rounded-full">
                  {urgentes.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setFiltroAba('proximos')}
              className={`py-1 px-2.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                filtroAba === 'proximos'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Próximos 7d</span>
              {proximos.length > 0 && (
                <span className="bg-cyan-500/20 text-cyan-300 text-[9px] px-1.5 py-0.2 rounded-full">
                  {proximos.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setFiltroAba('todos')}
              className={`py-1 px-2.5 rounded-lg font-semibold transition-all ${
                filtroAba === 'todos'
                  ? 'bg-surface-elevated text-text-primary border border-border'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Todos ({itens.length})
            </button>
          </div>

          {/* Lista de Notificações */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {loading && itens.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-xs">
                <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-gold" />
                <span>Buscando contas e lembretes...</span>
              </div>
            ) : itensExibidos.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-success opacity-80" />
                <p className="text-xs font-semibold text-text-primary">Tudo em dia!</p>
                <p className="text-[11px] mt-0.5 opacity-70">
                  {filtroAba === 'urgentes'
                    ? 'Nenhuma conta atrasada ou vencendo hoje.'
                    : 'Nenhum lembrete para esta categoria.'}
                </p>
              </div>
            ) : (
              itensExibidos.map(item => {
                const isAtrasado = item.statusPrazo === 'atrasado'
                const isHoje = item.statusPrazo === 'hoje'
                const isDespesa = item.tipo === 'despesa'

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false)
                      router.push('/financeiro')
                    }}
                    className={`p-3.5 hover:bg-surface-elevated transition-colors cursor-pointer group flex items-start justify-between gap-3 ${
                      isAtrasado ? 'bg-danger/[0.03]' : isHoje ? 'bg-amber-500/[0.03]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isDespesa
                            ? 'bg-danger/15 text-danger'
                            : 'bg-success/15 text-success'
                        }`}
                      >
                        {isDespesa ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isAtrasado ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-danger text-white">
                              ATRASADO ({Math.abs(item.diasDiferenca)}d)
                            </span>
                          ) : isHoje ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500 text-black">
                              VENCE HOJE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                              Em {item.diasDiferenca}d
                            </span>
                          )}

                          <span className="text-[10px] text-text-secondary font-mono">
                            {formatDate(item.dataVencimento)}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-text-primary mt-1 truncate">
                          {item.titulo}
                        </p>

                        {item.subtitulo && (
                          <p className="text-[10px] text-text-secondary truncate mt-0.5">
                            {item.subtitulo}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`font-display text-xs font-bold tabular-nums ${
                              isDespesa ? 'text-danger' : 'text-success'
                            }`}
                          >
                            {isDespesa ? '− ' : '+ '}
                            {formatCurrency(item.valor)}
                          </span>

                          <span className="text-[9px] text-text-secondary px-1.5 py-0.2 rounded bg-surface border border-border">
                            {item.empresa === 'jota_tech' ? 'Tech' : item.empresa === 'holding' ? 'Holding' : 'Esportivo'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botão de Ação Rápida WhatsApp para Clientes */}
                    {item.tipo === 'receita' && (
                      <div className="shrink-0 flex items-center">
                        <button
                          type="button"
                          onClick={(e) => handleCopiarWhatsApp(item, e)}
                          title="Copiar texto de cobrança para WhatsApp"
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/15 border border-emerald-500/30 transition-colors"
                        >
                          {copiadoId === item.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Rodapé do Popover */}
          <div className="p-3 border-t border-border bg-surface-elevated flex items-center justify-between">
            <span className="text-[11px] text-text-secondary">
              Visível apenas para Gestores
            </span>
            <Link
              href="/financeiro"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-gold hover:underline flex items-center gap-1"
            >
              <span>Abrir Financeiro</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
