'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
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

interface KanbanColunaConfig {
  id: string
  label: string
  borderTop: string
  headerBg: string
  cardBg: string
}

type TabMesa = 'postagens' | 'notes' | 'checklist' | 'referencias' | 'historico'
type FilterPostagem = 'todas' | 'programados' | 'a_editar' | 'estoque' | 'postados'

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function addDays(d: Date, days: number) {
  const date = new Date(d)
  date.setDate(date.getDate() + days)
  return date
}

function formatYYYYMMDD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

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

  // Datas da semana atual
  const mondayStr = useMemo(() => formatYYYYMMDD(getMonday(new Date())), [])

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
  const [selectedMembro, setSelectedMembro] = useState<string>('todos')
  // Configuração Dinâmica das Colunas do Kanban
  const [kanbanColunas, setKanbanColunas] = useState<KanbanColunaConfig[]>(() => {
    const custom = (cliente as any).kanban_colunas_custom
    if (custom && Array.isArray(custom) && custom.length > 0) return custom
    return [
      { id: 'a_fazer', label: '📌 A Gravar / Pauta', borderTop: 'border-t-amber-500', headerBg: 'text-amber-400', cardBg: 'bg-amber-500/10 border-amber-500/30' },
      { id: 'em_andamento', label: '✂️ Em Edição', borderTop: 'border-t-blue-500', headerBg: 'text-blue-400', cardBg: 'bg-blue-500/10 border-blue-500/30' },
      { id: 'programado', label: '📅 Programado', borderTop: 'border-t-gold', headerBg: 'text-gold', cardBg: 'bg-gold/15 border-gold/50 shadow-gold-glow' },
      { id: 'concluido', label: '🚀 Postado', borderTop: 'border-t-emerald-500', headerBg: 'text-emerald-400', cardBg: 'bg-emerald-500/10 border-emerald-500/30' },
    ]
  })

  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editingColLabel, setEditingColLabel] = useState('')
  const [isNovaColunaModalOpen, setIsNovaColunaModalOpen] = useState(false)
  const [novaColunaNome, setNovaColunaNome] = useState('')

  // Salvar Colunas no Supabase
  async function saveColunas(updatedCols: KanbanColunaConfig[]) {
    setKanbanColunas(updatedCols)
    const supabase = createClient() as any
    await supabase.from('clientes').update({ kanban_colunas_custom: updatedCols }).eq('id', cliente.id)
  }

  // Renomear Coluna
  function handleRenameColuna(colId: string) {
    if (!editingColLabel.trim()) {
      setEditingColId(null)
      return
    }
    const updated = kanbanColunas.map(c =>
      c.id === colId ? { ...c, label: editingColLabel.trim() } : c
    )
    saveColunas(updated)
    setEditingColId(null)
    toast.success('Nome da coluna atualizado!')
  }

  // Adicionar Nova Coluna
  function handleAddNovaColuna(e: React.FormEvent) {
    e.preventDefault()
    if (!novaColunaNome.trim()) return

    const newColId = 'col_' + crypto.randomUUID().slice(0, 8)
    const presets = [
      { borderTop: 'border-t-purple-500', headerBg: 'text-purple-400', cardBg: 'bg-purple-500/10 border-purple-500/30' },
      { borderTop: 'border-t-cyan-500', headerBg: 'text-cyan-400', cardBg: 'bg-cyan-500/10 border-cyan-500/30' },
      { borderTop: 'border-t-rose-500', headerBg: 'text-rose-400', cardBg: 'bg-rose-500/10 border-rose-500/30' },
      { borderTop: 'border-t-indigo-500', headerBg: 'text-indigo-400', cardBg: 'bg-indigo-500/10 border-indigo-500/30' },
    ]
    const color = presets[kanbanColunas.length % presets.length]

    const newCol: KanbanColunaConfig = {
      id: newColId,
      label: novaColunaNome.trim(),
      ...color
    }

    const updated = [...kanbanColunas, newCol]
    saveColunas(updated)
    setNovaColunaNome('')
    setIsNovaColunaModalOpen(false)
    toast.success(`Nova coluna "${novaColunaNome}" criada!`)
  }

  // Excluir Coluna
  function handleDeleteColuna(colId: string) {
    if (kanbanColunas.length <= 1) {
      toast.error('Você deve ter pelo menos 1 coluna!')
      return
    }
    const updated = kanbanColunas.filter(c => c.id !== colId)
    saveColunas(updated)
    toast.success('Coluna removida!')
  }

  async function onKanbanDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId, destination } = result
    const newStatus = destination.droppableId

    setTarefas(prev =>
      prev.map(t => (t.id === draggableId ? { ...t, status: newStatus } : t))
    )

    const supabase = createClient() as any
    const { error } = await supabase.from('tarefas').update({ status: newStatus }).eq('id', draggableId)
    if (error) {
      toast.error('Erro ao mover Post-it: ' + error.message)
    } else {
      toast.success('Post-it de publicação movido!')
    }
  }

  // 1. Postagens da Semana Atual (Cronograma da Semana)
  const postagensSemanaAtual = useMemo(() => {
    return tarefas.filter(t => {
      // Se for visita pura, não exibe no quadro de postagens da mesa
      if (t.tipo_demanda === 'visita') return false
      // Se já foi postado (concluido) e a data/prazo é anterior a esta semana, vai pro Histórico
      const isPostadoAntigo = t.status === 'concluido' && t.prazo && t.prazo < mondayStr
      if (isPostadoAntigo) return false
      return true
    })
  }, [tarefas, mondayStr])

  // 2. Postagens Antigas Concluídas para a Aba Histórico
  const postagensAntigasHistorico = useMemo(() => {
    return tarefas.filter(t => {
      return t.status === 'concluido' && (!t.prazo || t.prazo < mondayStr)
    })
  }, [tarefas, mondayStr])

  // Postagens filtradas na aba Cronograma (Apenas da Semana Atual)
  const postagensFiltradas = useMemo(() => {
    return postagensSemanaAtual.filter(t => {
      const matchMembro =
        selectedMembro === 'todos' ||
        t.responsavel_id === selectedMembro ||
        (t.responsavel_ids && t.responsavel_ids.includes(selectedMembro))

      return matchMembro
    })
  }, [postagensSemanaAtual, selectedMembro])

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

    // Obter ou criar um projeto válido na tabela 'projetos' (nunca usar ID de projetos_kanban)
    let projId = projetos.find((p: any) => p && p.id && !p.id.startsWith('temp_'))?.id
    if (!projId) {
      // Verificar se já existe um projeto deste cliente no banco
      const { data: existingProj } = await supabase
        .from('projetos')
        .select('id')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingProj?.id) {
        projId = existingProj.id
      } else {
        const { data: newProj, error: projErr } = await supabase
          .from('projetos')
          .insert({ nome: `Mesa - ${cliente.nome}`, cliente_id: cliente.id, status: 'em_andamento' })
          .select('id')
          .single()
        if (projErr) throw projErr
        projId = newProj?.id
      }
    }

    const currentUserProfile = membros.find(m => m.user_id === currentUserId || m.id === currentUserId)
    const effectiveRespId = novaPautaRespId || currentUserProfile?.id || null

    let insertPayload: any = {
      projeto_id: projId,
      tipo_demanda: 'postagem',
      titulo: novaPautaTitulo.trim(),
      descricao: novaPautaDesc.trim() || null,
      status: novaPautaStatus,
      formato_video: novaPautaFormato || novaPautaPlataforma || 'reels',
      plataforma_programada: novaPautaPlataforma || 'instagram',
      responsavel_id: effectiveRespId,
      responsavel_ids: effectiveRespId ? [effectiveRespId] : [],
      prazo: novaPautaPrazo || null,
      horario_inicio: novaPautaHorario || null
    }

    let { data, error } = await supabase
      .from('tarefas')
      .insert(insertPayload)
      .select('*, responsavel:profiles(*)')
      .single()

    if (error && (error.message?.includes('formato_video') || error.message?.includes('plataforma_programada'))) {
      delete insertPayload.formato_video
      delete insertPayload.plataforma_programada
      const retry = await supabase
        .from('tarefas')
        .insert(insertPayload)
        .select('*, responsavel:profiles(*)')
        .single()
      data = retry.data
      error = retry.error
    }

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
          {/* Filtro de Responsável com Avatares (Ajuda do Gestor) */}
          <div className="flex items-center gap-1.5 p-2 bg-surface rounded-xl border border-border overflow-x-auto">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider px-2 flex items-center gap-1 shrink-0">
              <User size={12} className="text-gold" /> Filtrar por Responsável / Filmmaker:
            </span>

            <button
              onClick={() => setSelectedMembro('todos')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                selectedMembro === 'todos'
                  ? 'bg-gold text-black shadow-sm'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              Todos ({membros.length})
            </button>

            {membros.map(m => {
              const isSelected = selectedMembro === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMembro(isSelected ? 'todos' : m.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all shrink-0 border ${
                    isSelected
                      ? 'border-gold bg-gold/15 text-gold font-bold shadow-gold-glow'
                      : 'border-border/60 bg-surface-elevated hover:border-gold/30 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-gold-muted border border-gold/30 flex items-center justify-center shrink-0 overflow-hidden text-[8px] font-bold">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.nome} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(m.nome)
                    )}
                  </div>
                  <span className="truncate max-w-[100px]">{m.nome.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>

          {/* Header da Seção de Publicações (Limpo sem sub-filtros redundantes) */}
          <div className="flex items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <Tv size={15} className="text-gold" />
              <span className="font-display text-xs font-bold text-text-primary">
                Quadro Kanban de Publicações
              </span>
              <span className="text-[10px] font-mono font-bold bg-gold-muted text-gold border border-gold/30 px-2 py-0.5 rounded-full">
                {postagensSemanaAtual.length} Peças na Semana
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNovaColunaModalOpen(true)}
                className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap flex items-center gap-1"
              >
                <Plus size={14} />
                <span>+ Nova Coluna</span>
              </button>
              <button onClick={() => setIsNovaPautaOpen(true)} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap shadow-gold-glow">
                + Cadastrar Vídeo
              </button>
            </div>
          </div>

          {/* Kanban Board Trello / Post-it Style — Dynamic & Fully Responsive */}
          <DragDropContext onDragEnd={onKanbanDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 select-none w-full scrollbar-thin">
              {kanbanColunas.map((col, colIdx) => {
                const colTasks = postagensFiltradas.filter(t => {
                  if (col.id === 'programado') {
                    return t.status === 'programado' || (t.status === 'em_andamento' && t.data_programacao)
                  }
                  return t.status === col.id
                })

                const isEditing = editingColId === col.id

                return (
                  <div
                    key={col.id}
                    className={`flex-1 min-w-[240px] max-w-[320px] bg-surface border border-border/80 rounded-2xl flex flex-col overflow-hidden shadow-lg border-t-4 ${col.borderTop}`}
                  >
                    {/* Header da Coluna Kanban (Editável) */}
                    <div className="p-3 border-b border-border/60 flex items-center justify-between bg-surface-elevated/40">
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingColLabel}
                          onChange={e => setEditingColLabel(e.target.value)}
                          onBlur={() => handleRenameColuna(col.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameColuna(col.id)
                          }}
                          className="input py-0.5 px-2 text-xs bg-surface border-gold font-bold w-[140px]"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            onClick={() => {
                              setEditingColId(col.id)
                              setEditingColLabel(col.label)
                            }}
                            className={`font-display text-xs font-bold truncate cursor-pointer hover:underline ${col.headerBg}`}
                            title="Clique para renomear a coluna"
                          >
                            {col.label}
                          </span>
                          <button
                            onClick={() => {
                              setEditingColId(col.id)
                              setEditingColLabel(col.label)
                            }}
                            className="text-text-secondary hover:text-gold p-0.5 opacity-40 hover:opacity-100"
                            title="Renomear Coluna"
                          >
                            <Edit size={11} />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono font-bold bg-surface px-2 py-0.5 rounded-full border border-border">
                          {colTasks.length}
                        </span>
                        {kanbanColunas.length > 1 && (
                          <button
                            onClick={() => handleDeleteColuna(col.id)}
                            className="text-text-secondary hover:text-danger p-1 opacity-30 hover:opacity-100 transition-opacity"
                            title="Excluir Coluna"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Droppable Area */}
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-2.5 flex-1 flex flex-col gap-2.5 min-h-[350px] transition-colors ${
                            snapshot.isDraggingOver ? 'bg-gold/5' : ''
                          }`}
                        >
                          {colTasks.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border/40 rounded-xl p-4 text-center">
                              <p className="text-[10px] text-text-secondary/50 italic">Sem post-its nesta coluna</p>
                            </div>
                          ) : (
                            colTasks.map((t, index) => (
                              <Draggable key={t.id} draggableId={t.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`p-3.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing space-y-2 flex flex-col justify-between ${col.cardBg} ${
                                      snapshot.isDragging ? 'shadow-2xl scale-[1.04] rotate-1 z-50' : 'hover:border-gold/50 shadow-sm'
                                    }`}
                                  >
                                    <div>
                                      {/* Top Badges */}
                                      <div className="flex items-center justify-between gap-1 mb-1.5">
                                        <span className="text-[8px] font-mono font-bold text-gold uppercase tracking-wider bg-black/50 px-1.5 py-0.5 rounded border border-gold/20">
                                          {t.plataforma_programada || t.formato_video || 'Instagram Reels'}
                                        </span>

                                        <span className="text-[9px] font-mono text-text-secondary">
                                          #{index + 1}
                                        </span>
                                      </div>

                                      {/* Titulo do Post-it */}
                                      <h4 className="text-xs font-bold text-text-primary leading-snug line-clamp-2">
                                        {t.titulo}
                                      </h4>
                                      {t.descricao && (
                                        <p className="text-[10px] text-text-secondary mt-1 line-clamp-2 italic">
                                          {t.descricao}
                                        </p>
                                      )}

                                      {/* Ficha Prominente de Data & Horário de Publicação */}
                                      <div className="mt-2.5 mb-1 p-2 rounded-lg bg-black/50 border border-gold/30 flex items-center justify-between text-[10px] shadow-inner">
                                        <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Postar em:</span>
                                        <div className="font-mono font-bold text-gold flex items-center gap-1.5">
                                          <span className="flex items-center gap-1">
                                            <Calendar size={10} className="text-gold" />
                                            {t.prazo ? formatDate(t.prazo) : 'Sem Data'}
                                          </span>
                                          <span className="text-text-secondary">•</span>
                                          <span className="flex items-center gap-1 bg-gold/20 px-1.5 py-0.5 rounded text-gold font-bold">
                                            <Clock size={10} />
                                            {t.horario_inicio ? t.horario_inicio.slice(0, 5) : '18:00'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Footer do Post-it */}
                                    <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[9px] text-text-secondary">
                                      <span className="truncate max-w-[120px]">
                                        {t.responsavel ? t.responsavel.nome.split(' ')[0] : 'Sem editor'}
                                      </span>

                                      {/* Botões Rápidos de Mudança de Status */}
                                      <div className="flex items-center gap-1">
                                        {colIdx > 0 && (
                                          <button
                                            onClick={e => {
                                              e.stopPropagation()
                                              const prevCol = kanbanColunas[colIdx - 1]
                                              if (prevCol) handleMudarStatusPostagem(t.id, prevCol.id)
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-all font-bold"
                                            title="Voltar Coluna"
                                          >
                                            ◀
                                          </button>
                                        )}
                                        {colIdx < kanbanColunas.length - 1 && (
                                          <button
                                            onClick={e => {
                                              e.stopPropagation()
                                              const nextCol = kanbanColunas[colIdx + 1]
                                              if (nextCol) handleMudarStatusPostagem(t.id, nextCol.id)
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-gold/20 hover:bg-gold text-gold hover:text-black font-bold transition-all"
                                            title="Avançar Coluna"
                                          >
                                            ▶
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}

              {/* Botão Adicionar Coluna no final do Kanban */}
              <button
                onClick={() => setIsNovaColunaModalOpen(true)}
                className="flex-1 min-w-[200px] max-w-[240px] h-[350px] rounded-2xl border border-dashed border-border/60 hover:border-gold/50 bg-surface/30 hover:bg-surface-elevated/40 flex flex-col items-center justify-center gap-2 text-text-secondary hover:text-gold transition-all shrink-0 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-bold">+ Criar Nova Coluna</span>
              </button>
            </div>
          </DragDropContext>
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

      {/* TAB 5: HISTÓRICO DE PUBLICAÇÕES ANTIGAS & INTERAÇÕES */}
      {activeTab === 'historico' && (
        <div className="space-y-6 animate-fade-in">
          {/* Seção 1: Publicações Antigas Concluídas em Semanas Anteriores */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-text-primary flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-success" /> Publicações Antigas Concluídas ({postagensAntigasHistorico.length})
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">Histórico de vídeos postados em semanas anteriores</p>
              </div>
            </div>

            {postagensAntigasHistorico.length === 0 ? (
              <p className="text-xs text-text-secondary italic py-6 text-center">Nenhuma publicação antiga arquivada ainda.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {postagensAntigasHistorico.map(p => (
                  <div key={p.id} className="p-3 rounded-xl bg-surface-elevated/40 border border-success/30 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="badge-success text-[9px] font-bold uppercase">🚀 PUBLICADO</span>
                      <span className="text-[10px] text-text-secondary font-mono">{formatDate(p.prazo)}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-text-primary truncate">{p.titulo}</h4>
                    {p.responsavel && (
                      <p className="text-[10px] text-text-secondary">Editor: {p.responsavel.nome}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção 2: Linha do Tempo de Interações */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-sm font-bold text-text-primary flex items-center gap-2">
                <MessageSquare size={16} className="text-gold" /> Linha do Tempo de Reuniões & Contatos
              </h3>
              <RegistrarInteracaoModal clienteId={cliente.id} clienteNome={cliente.nome} />
            </div>

            {interacoes.length === 0 ? (
              <p className="text-xs text-text-secondary italic py-6 text-center">Nenhum registro de contato ou reunião.</p>
            ) : (
              <div className="space-y-3 pt-1">
                {interacoes.map(i => (
                  <div key={i.id} className="p-3.5 rounded-xl bg-surface-elevated border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gold">{i.autor?.nome || 'Usuário'}</span>
                      <span className="text-text-secondary text-[10px]">{formatDate(i.created_at)}</span>
                    </div>
                    <p className="text-xs text-text-primary whitespace-pre-line leading-relaxed">{i.descricao}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
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

      {/* Modal Criar Nova Coluna */}
      {isNovaColunaModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-in">
            <h3 className="font-display text-base font-bold text-text-primary flex items-center gap-2">
              <Plus size={18} className="text-gold" /> Criar Nova Coluna no Kanban
            </h3>
            <form onSubmit={handleAddNovaColuna} className="space-y-4">
              <div>
                <label className="label">Nome da Coluna *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Em Validação pelo Cliente, Rascunhos..."
                  value={novaColunaNome}
                  onChange={e => setNovaColunaNome(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsNovaColunaModalOpen(false)} className="btn-ghost text-xs py-2 px-4">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-xs py-2 px-4 shadow-gold-glow">
                  Criar Coluna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
