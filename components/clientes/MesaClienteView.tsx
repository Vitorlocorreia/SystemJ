'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Edit,
  Building2,
  Calendar,
  User,
  Plus,
  Trash2,
  ExternalLink,
  CheckSquare,
  FileText,
  Link2,
  MessageSquare,
  Check,
  Clock,
  AlertTriangle,
  Play,
  Film,
  Sparkles,
  Share2,
  Package,
  CheckCircle2,
  Send,
  Radio,
  Tv
} from 'lucide-react'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import type { Cliente, StatusCliente, Profile, Tarefa, ChecklistItem, ReferenciaItem } from '@/types'
import ExcluirClienteButton from './ExcluirClienteButton'
import RegistrarInteracaoModal from './RegistrarInteracaoModal'

interface Props {
  cliente: Cliente
  projetos: any[]
  projetosKanban: any[]
  tarefas: any[]
  interacoes: any[]
  membros: Profile[]
  currentUserId: string
  isGestor: boolean
}

type TabMesa = 'postagens' | 'notes' | 'checklist' | 'referencias' | 'historico'
type FilterPostagem = 'todas' | 'programados' | 'a_editar' | 'estoque' | 'postados'

export default function MesaClienteView({
  cliente,
  projetos,
  projetosKanban,
  tarefas: tarefasIniciais,
  interacoes: interacoesIniciais,
  membros,
  currentUserId,
  isGestor
}: Props) {
  const [activeTab, setActiveTab] = useState<TabMesa>('postagens')
  const [filterPostagem, setFilterPostagem] = useState<FilterPostagem>('todas')
  const [tarefas, setTarefas] = useState<any[]>(tarefasIniciais)
  const [interacoes, setInteracoes] = useState<any[]>(interacoesIniciais)

  // Apple Notes do Cliente
  const [notasCliente, setNotasCliente] = useState<string>(
    (cliente as any).notas_cliente || ''
  )
  const [savingNotas, setSavingNotas] = useState(false)

  // Checklist Geral do Cliente
  const [checklistCliente, setChecklistCliente] = useState<ChecklistItem[]>(
    (cliente as any).checklist_cliente || []
  )
  const [novoChecklistText, setNovoChecklistText] = useState('')

  // Links de Referência do Cliente
  const [referenciasCliente, setReferenciasCliente] = useState<ReferenciaItem[]>(
    (cliente as any).referencias_cliente || []
  )
  const [novoRefTitle, setNovoRefTitle] = useState('')
  const [novoRefUrl, setNovoRefUrl] = useState('')

  // Nova Postagem / Vídeo Modal
  const [isNovaPautaOpen, setIsNovaPautaOpen] = useState(false)
  const [novaPautaTitulo, setNovaPautaTitulo] = useState('')
  const [novaPautaDesc, setNovaPautaDesc] = useState('')
  const [novaPautaPrazo, setNovaPautaPrazo] = useState('')
  const [novaPautaHorario, setNovaPautaHorario] = useState('')
  const [novaPautaFormato, setNovaPautaFormato] = useState('reels')
  const [novaPautaPlataforma, setNovaPautaPlataforma] = useState('instagram')
  const [novaPautaStatus, setNovaPautaStatus] = useState<string>('a_fazer')
  const [novaPautaRespId, setNovaPautaRespId] = useState('')
  const [creatingPauta, setCreatingPauta] = useState(false)

  // Filtered Postagens
  const postagensFiltradas = useMemo(() => {
    return tarefas.filter(t => {
      if (filterPostagem === 'programados') {
        return t.status === 'programado' || t.data_programacao || (t.status === 'em_andamento' && t.prazo)
      }
      if (filterPostagem === 'a_editar') {
        return t.status === 'a_fazer' || t.status === 'em_andamento'
      }
      if (filterPostagem === 'estoque') {
        return t.tipo_demanda === 'estoque' || t.status === 'estoque'
      }
      if (filterPostagem === 'postados') {
        return t.status === 'concluido'
      }
      return true
    })
  }, [tarefas, filterPostagem])

  // Handlers para Mudar Status da Postagem em 1 Clique
  async function handleMudarStatusPostagem(tarefaId: string, novoStatus: string) {
    setTarefas(prev =>
      prev.map(t => (t.id === tarefaId ? { ...t, status: novoStatus } : t))
    )

    const supabase = createClient() as any
    const { error } = await supabase
      .from('tarefas')
      .update({ status: novoStatus })
      .eq('id', tarefaId)

    if (error) {
      toast.error('Erro ao atualizar status do vídeo: ' + error.message)
    } else {
      const labels: Record<string, string> = {
        programado: 'Vídeo agendado para publicação! 📅',
        concluido: 'Vídeo marcado como publicado! 🚀',
        estoque: 'Vídeo guardado no Estoque do Cliente! 📦',
        em_andamento: 'Vídeo movido para Em Edição! ✂️'
      }
      toast.success(labels[novoStatus] || 'Status atualizado!')
    }
  }

  // Salvar Notas do Cliente no Supabase
  async function handleSalvarNotas() {
    setSavingNotas(true)
    const supabase = createClient() as any
    const { error } = await supabase
      .from('clientes')
      .update({ notas_cliente: notasCliente })
      .eq('id', cliente.id)

    setSavingNotas(false)
    if (error) {
      toast.error('Erro ao salvar notas: ' + error.message)
    } else {
      toast.success('Notas da mesa do cliente salvas!')
    }
  }

  // Checklist Handlers
  async function handleToggleChecklist(id: string) {
    const updated = checklistCliente.map(item =>
      item.id === id ? { ...item, concluido: !item.concluido } : item
    )
    setChecklistCliente(updated)
    const supabase = createClient() as any
    await supabase.from('clientes').update({ checklist_cliente: updated }).eq('id', cliente.id)
  }

  async function handleAddChecklist(e: React.FormEvent) {
    e.preventDefault()
    if (!novoChecklistText.trim()) return
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      texto: novoChecklistText.trim(),
      concluido: false
    }
    const updated = [...checklistCliente, newItem]
    setChecklistCliente(updated)
    setNovoChecklistText('')
    const supabase = createClient() as any
    await supabase.from('clientes').update({ checklist_cliente: updated }).eq('id', cliente.id)
    toast.success('Item adicionado ao checklist!')
  }

  async function handleDeleteChecklist(id: string) {
    const updated = checklistCliente.filter(item => item.id !== id)
    setChecklistCliente(updated)
    const supabase = createClient() as any
    await supabase.from('clientes').update({ checklist_cliente: updated }).eq('id', cliente.id)
  }

  // Referências Handlers
  async function handleAddReferencia(e: React.FormEvent) {
    e.preventDefault()
    if (!novoRefTitle.trim() || !novoRefUrl.trim()) return
    const newRef: ReferenciaItem = {
      id: crypto.randomUUID(),
      titulo: novoRefTitle.trim(),
      url: novoRefUrl.trim()
    }
    const updated = [...referenciasCliente, newRef]
    setReferenciasCliente(updated)
    setNovoRefTitle('')
    setNovoRefUrl('')
    const supabase = createClient() as any
    await supabase.from('clientes').update({ referencias_cliente: updated }).eq('id', cliente.id)
    toast.success('Link de inspiração anexado ao cliente!')
  }

  async function handleDeleteReferencia(id: string) {
    const updated = referenciasCliente.filter(r => r.id !== id)
    setReferenciasCliente(updated)
    const supabase = createClient() as any
    await supabase.from('clientes').update({ referencias_cliente: updated }).eq('id', cliente.id)
  }

  // Criar Nova Pauta / Postagem
  async function handleCriarPauta(e: React.FormEvent) {
    e.preventDefault()
    if (!novaPautaTitulo.trim()) return

    setCreatingPauta(true)
    const supabase = createClient() as any

    let projId = projetos[0]?.id || projetosKanban[0]?.id
    if (!projId) {
      const { data: newProj } = await supabase
        .from('projetos')
        .insert({ nome: `Mesa - ${cliente.nome}`, cliente_id: cliente.id, status: 'em_andamento' })
        .select('id')
        .single()
      projId = newProj?.id
    }

    const { data, error } = await supabase
      .from('tarefas')
      .insert({
        projeto_id: projId,
        titulo: novaPautaTitulo.trim(),
        descricao: novaPautaDesc.trim() || null,
        status: novaPautaStatus,
        formato_video: novaPautaFormato,
        plataforma_programada: novaPautaPlataforma,
        responsavel_id: novaPautaRespId || currentUserId,
        responsavel_ids: novaPautaRespId ? [novaPautaRespId] : [currentUserId],
        prazo: novaPautaPrazo || null,
        horario_inicio: novaPautaHorario || null
      })
      .select('*, responsavel:profiles(*)')
      .single()

    setCreatingPauta(false)

    if (error) {
      toast.error('Erro ao cadastrar postagem: ' + error.message)
    } else {
      setTarefas(prev => [data, ...prev])
      setNovaPautaTitulo('')
      setNovaPautaDesc('')
      setNovaPautaPrazo('')
      setNovaPautaHorario('')
      setIsNovaPautaOpen(false)
      toast.success('Vídeo/Postagem adicionada ao cronograma de publicação!')
    }
  }

  const logoUrl = (cliente as any).logo_url || (cliente as any).avatar_url

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl pb-16">
      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-border p-5 rounded-2xl">
        <div className="flex items-center gap-4">
          <Link href="/semana" className="btn-ghost p-2 -ml-2">
            <ArrowLeft size={18} />
          </Link>

          {/* Logo / Profile Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gold-muted border-2 border-gold/40 flex items-center justify-center shrink-0 overflow-hidden shadow-gold-glow text-gold font-bold font-display text-xl">
            {logoUrl ? (
              <img src={logoUrl} alt={cliente.nome} className="w-full h-full object-cover" />
            ) : (
              getInitials(cliente.nome)
            )}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-text-primary">{cliente.nome}</h1>
              <span className="badge-gold text-xs uppercase tracking-wider font-bold">
                {cliente.status}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Hub de Cronograma & Programação de Publicações • {cliente.segmento || 'Sem segmento'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isGestor && (
            <ExcluirClienteButton clienteId={cliente.id} clienteNome={cliente.nome} isGestor={isGestor} />
          )}
          <Link href={`/clientes/${cliente.id}/editar`} className="btn-secondary flex items-center gap-2 text-xs py-2">
            <Edit size={14} />
            <span>Perfil</span>
          </Link>
          <button onClick={() => setIsNovaPautaOpen(true)} className="btn-primary flex items-center gap-2 text-xs py-2 shadow-gold-glow">
            <Plus size={15} />
            <span>+ Programar / Cadastrar Vídeo</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('postagens')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'postagens' ? 'border-gold text-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Tv size={15} />
          <span>Cronograma de Publicações ({tarefas.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'notes' ? 'border-gold text-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText size={15} />
          <span>Apple Notes & Legendas</span>
        </button>

        <button
          onClick={() => setActiveTab('checklist')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'checklist' ? 'border-gold text-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <CheckSquare size={15} />
          <span>Checklist ({checklistCliente.filter(c => c.concluido).length}/{checklistCliente.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('referencias')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'referencias' ? 'border-gold text-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Link2 size={15} />
          <span>Links de Inspiração ({referenciasCliente.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('historico')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'historico' ? 'border-gold text-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <MessageSquare size={15} />
          <span>Histórico ({interacoes.length})</span>
        </button>
      </div>

      {/* TAB 1: CRONOGRAMA DE PUBLICAÇÕES DE VÍDEOS */}
      {activeTab === 'postagens' && (
        <div className="space-y-4 animate-fade-in">
          {/* Sub-filtros por Status de Publicação */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => setFilterPostagem('todas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filterPostagem === 'todas' ? 'bg-gold text-black' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                Todas as Peças ({tarefas.length})
              </button>
              <button
                onClick={() => setFilterPostagem('programados')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  filterPostagem === 'programados' ? 'bg-gold text-black' : 'bg-surface-elevated text-gold hover:bg-gold/10'
                }`}
              >
                <Calendar size={13} />
                <span>📅 Programados</span>
              </button>
              <button
                onClick={() => setFilterPostagem('a_editar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  filterPostagem === 'a_editar' ? 'bg-gold text-black' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                <Film size={13} />
                <span>✂️ Em Edição</span>
              </button>
              <button
                onClick={() => setFilterPostagem('estoque')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  filterPostagem === 'estoque' ? 'bg-gold text-black' : 'bg-surface-elevated text-cyan-400 hover:bg-cyan-400/10'
                }`}
              >
                <Package size={13} />
                <span>📦 Estoque de Reserva</span>
              </button>
              <button
                onClick={() => setFilterPostagem('postados')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  filterPostagem === 'postados' ? 'bg-gold text-black' : 'bg-surface-elevated text-success hover:bg-success/10'
                }`}
              >
                <CheckCircle2 size={13} />
                <span>🚀 Postados</span>
              </button>
            </div>

            <button onClick={() => setIsNovaPautaOpen(true)} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
              + Cadastrar Vídeo
            </button>
          </div>

          {/* Cards de Publicação & Programação */}
          {postagensFiltradas.length === 0 ? (
            <div className="card text-center py-12 space-y-3">
              <Tv size={36} className="mx-auto text-text-secondary opacity-30" />
              <p className="text-sm font-medium text-text-primary">Nenhuma postagem cadastrada neste filtro.</p>
              <button onClick={() => setIsNovaPautaOpen(true)} className="btn-primary text-xs py-2 px-4 mx-auto">
                + Programar Nova Postagem
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {postagensFiltradas.map(t => {
                const isProgramado = t.status === 'programado' || t.data_programacao
                const isPostado = t.status === 'concluido'
                const isEstoque = t.status === 'estoque' || t.tipo_demanda === 'estoque'

                return (
                  <div
                    key={t.id}
                    className={`card bg-surface-elevated/40 border transition-all space-y-3.5 relative flex flex-col justify-between ${
                      isProgramado
                        ? 'border-gold/50 bg-gold/5 shadow-gold-glow'
                        : isPostado
                        ? 'border-success/40 bg-success/5'
                        : isEstoque
                        ? 'border-cyan-500/40 bg-cyan-500/5'
                        : 'border-border hover:border-gold/30'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          isProgramado
                            ? 'bg-gold text-black font-extrabold'
                            : isPostado
                            ? 'bg-success/20 text-success border border-success/30 font-bold'
                            : isEstoque
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold'
                            : 'bg-surface text-text-secondary border border-border'
                        }`}>
                          {isProgramado
                            ? '📅 PROGRAMADO'
                            : isPostado
                            ? '🚀 PUBLICADO'
                            : isEstoque
                            ? '📦 ESTOQUE'
                            : t.status.replace(/_/g, ' ')}
                        </span>

                        <span className="text-[9px] font-mono text-gold font-bold uppercase">
                          {t.plataforma_programada || t.formato_video || 'Reels / TikTok'}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-sm font-semibold text-text-primary leading-snug">{t.titulo}</h4>
                      {t.descricao && <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{t.descricao}</p>}

                      {/* Agendamento Date & Time info */}
                      {t.prazo && (
                        <div className="mt-3 p-2 rounded-lg bg-surface border border-border/60 flex items-center justify-between text-[11px]">
                          <span className="text-text-secondary font-bold uppercase text-[9px]">Data da Postagem:</span>
                          <span className="font-mono font-bold text-gold flex items-center gap-1">
                            <Clock size={11} />
                            {formatDate(t.prazo)} {t.horario_inicio ? `às ${t.horario_inicio.slice(0, 5)}` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick Status Action Controls */}
                    <div className="pt-2 border-t border-border/40 space-y-2">
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className="text-text-secondary">Mudar Status:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMudarStatusPostagem(t.id, 'programado')}
                            className="px-2 py-1 rounded bg-gold/20 hover:bg-gold text-gold hover:text-black font-bold transition-all"
                            title="Marcar como Programado"
                          >
                            📅 Programar
                          </button>
                          <button
                            onClick={() => handleMudarStatusPostagem(t.id, 'estoque')}
                            className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500 text-cyan-400 hover:text-black font-bold transition-all"
                            title="Mover para Estoque de Reserva"
                          >
                            📦 Estoque
                          </button>
                          <button
                            onClick={() => handleMudarStatusPostagem(t.id, 'concluido')}
                            className="px-2 py-1 rounded bg-success/20 hover:bg-success text-success hover:text-black font-bold transition-all"
                            title="Marcar como Postado"
                          >
                            🚀 Postado
                          </button>
                        </div>
                      </div>

                      {t.responsavel && (
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                          <User size={11} className="text-gold" />
                          <span>Editor / Responsável: {t.responsavel.nome}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPLE NOTES & LEGENDAS */}
      {activeTab === 'notes' && (
        <div className="card p-0 overflow-hidden animate-fade-in border border-border rounded-2xl">
          <div className="p-4 border-b border-border bg-surface flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-text-primary flex items-center gap-2">
                <FileText size={16} className="text-gold" /> Apple Notes & Rascunho de Legendas de {cliente.nome}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Espaço para copywriter, storymaker e editor rascunharem legendas, orientações e roteiros
              </p>
            </div>
            <button onClick={handleSalvarNotas} disabled={savingNotas} className="btn-primary text-xs py-1.5 px-4">
              {savingNotas ? 'Salvando...' : 'Salvar Legendas'}
            </button>
          </div>

          <div className="p-4">
            <textarea
              rows={16}
              value={notasCliente}
              onChange={e => setNotasCliente(e.target.value)}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-2xl p-5 text-sm text-[#E0E0E0] placeholder-text-secondary/40 font-mono leading-relaxed focus:outline-none focus:border-gold/50 resize-none"
              placeholder={"- Legenda para o Reels de Segunda:\n  🔥 Bastidores do treino pesado...\n  #futebol #treino #jotaesportivo\n\n- Tom de voz e hashtags do cliente..."}
            />
          </div>
        </div>
      )}

      {/* TAB 3: CHECKLIST DE PRODUÇÃO */}
      {activeTab === 'checklist' && (
        <div className="card space-y-5 animate-fade-in">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">Checklist de Produção & Entregáveis</h3>
            <p className="text-xs text-text-secondary mt-0.5">Lista de conteúdos e especificações que devem ser postados/entregues para este cliente</p>
          </div>

          <form onSubmit={handleAddChecklist} className="flex gap-2">
            <input
              type="text"
              placeholder="Ex: 4 vídeos em pé com CTA para Instagram Reels..."
              value={novoChecklistText}
              onChange={e => setNovoChecklistText(e.target.value)}
              className="input text-xs flex-1"
            />
            <button type="submit" className="btn-primary text-xs py-2 px-4">+ Adicionar Item</button>
          </form>

          <div className="space-y-2 pt-2">
            {checklistCliente.length === 0 ? (
              <p className="text-xs text-text-secondary italic py-6 text-center">Nenhum item cadastrado no checklist do cliente.</p>
            ) : (
              checklistCliente.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated border border-border hover:border-gold/20 transition-all">
                  <button onClick={() => handleToggleChecklist(item.id)} className="flex items-center gap-3 flex-1 text-left">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                      item.concluido ? 'bg-gold border-gold text-black' : 'border-border bg-background'
                    }`}>
                      {item.concluido && <Check size={12} strokeWidth={3} />}
                    </div>
                    <span className={`text-sm ${item.concluido ? 'line-through text-text-secondary' : 'text-text-primary font-medium'}`}>
                      {item.texto}
                    </span>
                  </button>
                  <button onClick={() => handleDeleteChecklist(item.id)} className="text-text-secondary hover:text-danger p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LINKS DE INSPIRAÇÃO */}
      {activeTab === 'referencias' && (
        <div className="card space-y-5 animate-fade-in">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">Links de Referência & Inspiração</h3>
            <p className="text-xs text-text-secondary mt-0.5">Exemplos de Reels, TikToks e referências visuais aprovadas para o cliente</p>
          </div>

          <form onSubmit={handleAddReferencia} className="space-y-3 bg-surface-elevated p-4 rounded-xl border border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Título (ex: Reel Viral 'Professor')..."
                value={novoRefTitle}
                onChange={e => setNovoRefTitle(e.target.value)}
                className="input text-xs"
              />
              <input
                type="url"
                required
                placeholder="URL (https://instagram.com/reel/...)"
                value={novoRefUrl}
                onChange={e => setNovoRefUrl(e.target.value)}
                className="input text-xs"
              />
            </div>
            <button type="submit" className="btn-secondary text-xs py-2 px-4 w-full">+ Anexar Referência</button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {referenciasCliente.length === 0 ? (
              <p className="text-xs text-text-secondary italic py-6 text-center sm:col-span-2">Nenhum link de inspiração anexado ainda.</p>
            ) : (
              referenciasCliente.map(ref => (
                <div key={ref.id} className="p-4 rounded-xl bg-surface-elevated border border-border hover:border-gold/30 transition-all space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-text-primary">{ref.titulo}</h4>
                    <button onClick={() => handleDeleteReferencia(ref.id)} className="text-text-secondary hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-gold hover:underline font-mono"
                  >
                    <ExternalLink size={12} />
                    <span>Abrir Reel / TikTok ↗</span>
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: HISTÓRICO & INTERAÇÕES */}
      {activeTab === 'historico' && (
        <div className="card space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-display text-sm font-bold text-text-primary">Linha do Tempo de Interações</h3>
            <RegistrarInteracaoModal clienteId={cliente.id} clienteNome={cliente.nome} />
          </div>

          {interacoes.length === 0 ? (
            <p className="text-xs text-text-secondary italic py-6 text-center">Nenhum registro de contato ou reunião.</p>
          ) : (
            <div className="space-y-4 pt-2">
              {interacoes.map(i => (
                <div key={i.id} className="p-4 rounded-xl bg-surface-elevated border border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gold">{i.autor?.nome || 'Usuário'}</span>
                    <span className="text-text-secondary">{formatDate(i.created_at)}</span>
                  </div>
                  <p className="text-sm text-text-primary whitespace-pre-line leading-relaxed">{i.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Nova Postagem / Vídeo */}
      {isNovaPautaOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-in">
            <h3 className="font-display text-lg font-bold text-text-primary">Programar Nova Postagem de Vídeo</h3>
            <form onSubmit={handleCriarPauta} className="space-y-4">
              <div>
                <label className="label">Título do Vídeo / Conteúdo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reels do Gol de Placa - Bastidores"
                  value={novaPautaTitulo}
                  onChange={e => setNovaPautaTitulo(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Descrição / Roteiro / Legenda</label>
                <textarea
                  rows={2}
                  placeholder="Instruções de edição, hashtags ou observações..."
                  value={novaPautaDesc}
                  onChange={e => setNovaPautaDesc(e.target.value)}
                  className="input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rede Social / Formato</label>
                  <select
                    value={novaPautaPlataforma}
                    onChange={e => setNovaPautaPlataforma(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="instagram">Instagram Reels 📸</option>
                    <option value="tiktok">TikTok 🎵</option>
                    <option value="stories">Stories 📲</option>
                    <option value="youtube">YouTube Shorts 📹</option>
                    <option value="carrossel">Carrossel / Post 🖼️</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status Inicial</label>
                  <select
                    value={novaPautaStatus}
                    onChange={e => setNovaPautaStatus(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="em_andamento">✂️ Em Edição</option>
                    <option value="programado">📅 Programado (Agendado)</option>
                    <option value="estoque">📦 Guardado em Estoque</option>
                    <option value="concluido">🚀 Já Publicado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Data de Postagem</label>
                  <input
                    type="date"
                    value={novaPautaPrazo}
                    onChange={e => setNovaPautaPrazo(e.target.value)}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label">Horário de Agendamento</label>
                  <input
                    type="time"
                    value={novaPautaHorario}
                    onChange={e => setNovaPautaHorario(e.target.value)}
                    className="input text-xs"
                    placeholder="18:00"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsNovaPautaOpen(false)} className="btn-ghost text-xs py-2 px-4">
                  Cancelar
                </button>
                <button type="submit" disabled={creatingPauta} className="btn-primary text-xs py-2 px-4 shadow-gold-glow">
                  {creatingPauta ? 'Cadastrando...' : 'Cadastrar Postagem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
