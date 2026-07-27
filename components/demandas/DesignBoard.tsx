'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Calendar, Search, X, MessageSquare, ChevronDown,
  Clock, CheckCircle2, Circle, Loader2, Send, Plus
} from 'lucide-react'
import { formatDate, getInitials } from '@/lib/utils'
import type { Tarefa, StatusTarefa, Profile, Projeto, ClientePublico } from '@/types'

const colunas: { id: StatusTarefa; label: string; accent: string; icon: React.ReactNode }[] = [
  { id: 'a_fazer', label: 'A Fazer', accent: 'border-t-border bg-surface', icon: <Circle size={13} className="text-text-secondary" /> },
  { id: 'em_andamento', label: 'Em Andamento', accent: 'border-t-gold bg-surface', icon: <Clock size={13} className="text-gold" /> },
  { id: 'concluido', label: 'Concluído', accent: 'border-t-success bg-surface', icon: <CheckCircle2 size={13} className="text-success" /> },
]

interface ExtendedTarefa extends Tarefa {
  responsavel: Profile | null
  responsaveis?: Profile[]
  projeto: {
    id: string
    nome: string
    cliente: {
      id: string
      nome: string
    } | null
  } | null
}

interface Props {
  tarefasIniciais: ExtendedTarefa[]
  membros: Profile[]
  projetos: (Projeto & { cliente: { id: string; nome: string } | null })[]
  currentUserId: string
  clientesDisponiveis?: ClientePublico[]
}

export default function DesignBoard({ tarefasIniciais, membros, projetos, currentUserId, clientesDisponiveis = [] }: Props) {
  // Singleton Supabase client
  const supabaseRef = useRef(createClient())

  const normalizarTarefas = useCallback((raw: any[]): ExtendedTarefa[] => {
    return raw.map(t => {
      const ids = t.responsavel_ids || (t.responsavel_id ? [t.responsavel_id] : [])
      const resps = membros.filter(m => ids.includes(m.id))
      return { ...t, responsavel_ids: ids, responsaveis: resps, responsavel: resps[0] || null }
    })
  }, [membros])

  const meuProfile = useMemo(() => membros.find(m => m.user_id === currentUserId), [membros, currentUserId])

  const [tarefas, setTarefas] = useState<ExtendedTarefa[]>(() => normalizarTarefas(tarefasIniciais))
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCliente, setSelectedCliente] = useState('todos')
  const [editingTarefa, setEditingTarefa] = useState<ExtendedTarefa | null>(null)
  const [comentarios, setComentarios] = useState<any[]>([])
  const [comentariosLoading, setComentariosLoading] = useState(false)
  const [novoComentario, setNovoComentario] = useState('')
  const [sendingComentario, setSendingComentario] = useState(false)

  // Create demand state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newClienteId, setNewClienteId] = useState(clientesDisponiveis[0]?.id || '')
  const [newPrazo, setNewPrazo] = useState('')
  const [loading, setLoading] = useState(false)

  // ─── Supabase Realtime ───────────────────────────────────────────
  useEffect(() => {
    const supabase = supabaseRef.current

    const channel = supabase
      .channel('design-board-tarefas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tarefas' },
        async (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const { data } = await supabase
              .from('tarefas')
              .select('*, responsavel:profiles(*), projeto:projetos(id, nome, cliente:clientes(id, nome))')
              .eq('id', payload.new.id)
              .single()
            if (data) {
              const normalized = normalizarTarefas([data])[0]
              // Só adiciona se o designer for responsável pela tarefa
              const ids = normalized.responsavel_ids || []
              if (meuProfile && ids.includes(meuProfile.id)) {
                setTarefas(prev => {
                  if (prev.some(t => t.id === data.id)) return prev
                  return [...prev, normalized]
                })
              }
            }
          }

          if (payload.eventType === 'UPDATE') {
            setTarefas(prev =>
              prev.map(t => {
                if (t.id !== payload.new.id) return t
                return normalizarTarefas([{ ...t, ...payload.new }])[0]
              })
            )
          }

          if (payload.eventType === 'DELETE') {
            setTarefas(prev => prev.filter(t => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [normalizarTarefas, meuProfile])

  // Clientes únicos a partir dos projetos, tarefas ou lista disponível
  const clientes = useMemo(() => {
    const map = new Map<string, string>()
    projetos.forEach(p => { if (p.cliente) map.set(p.cliente.id, p.cliente.nome) })
    tarefas.forEach(t => { if (t.projeto?.cliente) map.set(t.projeto.cliente.id, t.projeto.cliente.nome) })
    clientesDisponiveis.forEach(c => map.set(c.id, c.nome))
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [projetos, tarefas, clientesDisponiveis])

  const filteredTarefas = useMemo(() => {
    return tarefas.filter(t => {
      const matchSearch = t.titulo.toLowerCase().includes(searchTerm.toLowerCase())
      const matchCliente = selectedCliente === 'todos' || t.projeto?.cliente?.id === selectedCliente
      return matchSearch && matchCliente
    })
  }, [tarefas, searchTerm, selectedCliente])

  const tarefasPorColuna = useMemo(() => {
    const map: Record<StatusTarefa, ExtendedTarefa[]> = {
      a_fazer: [], em_andamento: [], concluido: []
    }
    filteredTarefas.forEach(t => { if (map[t.status]) map[t.status].push(t) })
    return map
  }, [filteredTarefas])

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return

    const newStatus = destination.droppableId as StatusTarefa
    const supabase = supabaseRef.current
    setTarefas(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t))

    const { error } = await supabase.from('tarefas').update({ status: newStatus }).eq('id', draggableId)
    if (error) {
      toast.error('Erro ao atualizar status')
      setTarefas(prev => prev.map(t => t.id === draggableId ? { ...t, status: source.droppableId as StatusTarefa } : t))
    } else {
      toast.success('Status atualizado!')
    }
  }

  async function openTarefa(tarefa: ExtendedTarefa) {
    setEditingTarefa(tarefa)
    setComentarios([])
    setComentariosLoading(true)
    const supabase = supabaseRef.current
    const { data } = await supabase
      .from('comentarios')
      .select('*, autor:profiles(nome, avatar_url)')
      .eq('tarefa_id', tarefa.id)
      .order('created_at', { ascending: true })
    setComentarios(data || [])
    setComentariosLoading(false)
  }

  async function handleEnviarComentario() {
    if (!novoComentario.trim() || !editingTarefa) return
    setSendingComentario(true)
    const supabase = supabaseRef.current
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', currentUserId).single()
    const { data, error } = await supabase
      .from('comentarios')
      .insert({ tarefa_id: editingTarefa.id, autor_id: profile?.id, conteudo: novoComentario.trim() })
      .select('*, autor:profiles(nome, avatar_url)')
      .single()
    if (!error && data) {
      setComentarios(prev => [...prev, data])
      setNovoComentario('')
    } else {
      toast.error('Erro ao enviar comentário')
    }
    setSendingComentario(false)
  }

  async function handleChangeStatus(novoStatus: StatusTarefa) {
    if (!editingTarefa) return
    const supabase = supabaseRef.current
    const { error } = await supabase.from('tarefas').update({ status: novoStatus }).eq('id', editingTarefa.id)
    if (!error) {
      setTarefas(prev => prev.map(t => t.id === editingTarefa.id ? { ...t, status: novoStatus } : t))
      setEditingTarefa(prev => prev ? { ...prev, status: novoStatus } : null)
      toast.success('Status atualizado!')
    }
  }

  // Helper: busca ou cria projeto para o cliente
  async function getOrCreateProjectForClient(supabase: any, clienteId: string): Promise<string | null> {
    const { data: proj } = await supabase
      .from('projetos')
      .select('id')
      .eq('cliente_id', clienteId)
      .limit(1)
      .maybeSingle()

    if (proj?.id) return proj.id

    const { data: cli } = await supabase.from('clientes').select('nome').eq('id', clienteId).single()
    const clientName = cli?.nome || 'Cliente'

    const { data: newProj, error } = await supabase
      .from('projetos')
      .insert({ nome: `Mesa - ${clientName}`, cliente_id: clienteId, status: 'em_andamento' })
      .select('id')
      .single()

    if (error) { console.error('Error creating project', error); return null }
    return newProj.id
  }

  // Criar nova demanda
  async function handleCreateDemand(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newClienteId) {
      toast.error('Preencha o título e selecione um cliente')
      return
    }

    setLoading(true)
    const supabase = supabaseRef.current

    // Auto-atribuir ao designer criador
    const respIds = meuProfile ? [meuProfile.id] : []

    const projId = await getOrCreateProjectForClient(supabase, newClienteId)
    if (!projId) { setLoading(false); return }

    const { data, error } = await supabase
      .from('tarefas')
      .insert({
        projeto_id: projId,
        titulo: newTitle.trim(),
        descricao: newDesc.trim() || null,
        status: 'a_fazer' as StatusTarefa,
        responsavel_id: respIds[0] || null,
        responsavel_ids: respIds,
        prazo: newPrazo || null,
        ordem: 0
      })
      .select('*, projeto:projetos(id, nome, cliente:clientes(id, nome))')
      .single()

    setLoading(false)

    if (error) {
      toast.error('Erro ao criar demanda: ' + error.message)
      return
    }

    const resps = membros.filter(m => respIds.includes(m.id))
    const newTarefa: ExtendedTarefa = { ...data, responsavel_ids: respIds, responsaveis: resps, responsavel: resps[0] || null }

    setTarefas(prev => {
      if (prev.some(t => t.id === newTarefa.id)) return prev
      return [...prev, newTarefa]
    })
    setIsCreateOpen(false)
    setNewTitle('')
    setNewDesc('')
    setNewPrazo('')
    toast.success('Demanda criada com sucesso!')
  }

  const statusBadge: Record<StatusTarefa, string> = {
    a_fazer: 'bg-surface-elevated text-text-secondary border border-border',
    em_andamento: 'bg-gold/10 text-gold border border-gold/30',
    concluido: 'bg-success/10 text-success border border-success/30',
  }
  const statusLabel: Record<StatusTarefa, string> = {
    a_fazer: 'A Fazer',
    em_andamento: 'Em Andamento',
    concluido: 'Concluído',
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-display-sm text-text-primary flex items-center gap-2">
            Minhas Demandas
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''} atribuída{tarefas.length !== 1 ? 's' : ''} a você
          </p>
        </div>
        {/* Botão Nova Demanda — disponível para designers */}
        <button
          onClick={() => {
            setNewClienteId(clientesDisponiveis[0]?.id || clientes[0]?.id || '')
            setIsCreateOpen(true)
          }}
          className="btn-primary flex items-center gap-2 text-sm py-2 px-4 self-start sm:self-auto"
        >
          <Plus size={16} />
          Nova Demanda
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar tarefa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input pl-9 w-full text-sm"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={selectedCliente}
            onChange={e => setSelectedCliente(e.target.value)}
            className="input text-sm pr-8 appearance-none min-w-[180px]"
          >
            <option value="todos">Todos os clientes</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {colunas.map(({ id, label, accent, icon }) => {
            const colTarefas = tarefasPorColuna[id]
            return (
              <div key={id} className={`card border-t-2 ${accent} flex flex-col gap-3`}>
                {/* Column header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">{label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-text-secondary bg-surface-elevated px-2 py-0.5 rounded-full border border-border">
                    {colTarefas.length}
                  </span>
                </div>

                <Droppable droppableId={id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col gap-2 min-h-[120px] rounded-xl transition-colors duration-150 ${snapshot.isDraggingOver ? 'bg-gold/5 ring-1 ring-gold/20' : ''}`}
                    >
                      {colTarefas.map((tarefa, index) => (
                        <Draggable key={tarefa.id} draggableId={tarefa.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              onClick={() => openTarefa(tarefa)}
                              className={`group p-3.5 rounded-xl border border-border bg-background hover:border-gold/30 hover:shadow-lg hover:shadow-black/20 transition-all duration-150 cursor-pointer ${snap.isDragging ? 'shadow-2xl shadow-black/40 ring-1 ring-gold/30 rotate-1' : ''}`}
                            >
                              {/* Cliente / Projeto */}
                              {tarefa.projeto && (
                                <p className="text-[10px] text-gold font-semibold uppercase tracking-wider mb-1.5 truncate">
                                  {tarefa.projeto.cliente?.nome ?? tarefa.projeto.nome}
                                </p>
                              )}
                              <p className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors leading-snug">
                                {tarefa.titulo}
                              </p>

                              {tarefa.descricao && (
                                <p className="text-xs text-text-secondary mt-1.5 line-clamp-2 leading-relaxed">
                                  {tarefa.descricao}
                                </p>
                              )}

                              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
                                {tarefa.prazo ? (
                                  <span className="flex items-center gap-1 text-[10px] text-text-secondary">
                                    <Calendar size={10} />
                                    {formatDate(tarefa.prazo)}
                                  </span>
                                ) : <span />}
                                <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusBadge[tarefa.status]}`}>
                                  {statusLabel[tarefa.status]}
                                </span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {colTarefas.length === 0 && (
                        <div className="flex-1 flex items-center justify-center py-8">
                          <p className="text-[11px] text-text-secondary/50 italic">Nenhuma tarefa aqui</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Detail Modal */}
      {editingTarefa && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingTarefa(null)} />
          <div className="relative w-full sm:max-w-lg bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
              <div className="min-w-0">
                {editingTarefa.projeto && (
                  <p className="text-[10px] text-gold font-bold uppercase tracking-wider mb-1">
                    {editingTarefa.projeto.cliente?.nome ?? editingTarefa.projeto.nome}
                  </p>
                )}
                <h2 className="text-base font-bold text-text-primary leading-snug">{editingTarefa.titulo}</h2>
              </div>
              <button onClick={() => setEditingTarefa(null)} className="shrink-0 p-1.5 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Status selector */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Status</p>
                <div className="flex gap-2 flex-wrap">
                  {colunas.map(col => (
                    <button
                      key={col.id}
                      onClick={() => handleChangeStatus(col.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${editingTarefa.status === col.id ? statusBadge[col.id] + ' scale-105' : 'border-border text-text-secondary hover:bg-surface-elevated'}`}
                    >
                      {col.icon}
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                {editingTarefa.prazo && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Prazo</p>
                    <p className="text-sm text-text-primary flex items-center gap-1.5">
                      <Calendar size={13} className="text-gold" />
                      {formatDate(editingTarefa.prazo)}
                    </p>
                  </div>
                )}
                {editingTarefa.projeto && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Projeto</p>
                    <p className="text-sm text-text-primary truncate">{editingTarefa.projeto.nome}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {editingTarefa.descricao && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Descrição</p>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap bg-surface-elevated/50 rounded-xl p-3 border border-border/60">
                    {editingTarefa.descricao}
                  </p>
                </div>
              )}

              {/* Responsáveis */}
              {editingTarefa.responsaveis && editingTarefa.responsaveis.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Responsáveis</p>
                  <div className="flex flex-wrap gap-2">
                    {editingTarefa.responsaveis.map(r => (
                      <div key={r.id} className="flex items-center gap-2 bg-surface-elevated border border-border px-2.5 py-1.5 rounded-lg">
                        <div className="w-5 h-5 rounded-full bg-gold-muted border border-gold/30 flex items-center justify-center overflow-hidden">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt={r.nome} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-gold text-[8px] font-bold">{getInitials(r.nome)}</span>
                          )}
                        </div>
                        <span className="text-xs text-text-primary">{r.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare size={11} /> Comentários
                </p>
                {comentariosLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-text-secondary" />
                  </div>
                ) : comentarios.length === 0 ? (
                  <p className="text-xs text-text-secondary italic">Nenhum comentário ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {comentarios.map((c: any) => (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-gold-muted border border-gold/30 flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
                          {c.autor?.avatar_url ? (
                            <img src={c.autor.avatar_url} alt={c.autor?.nome} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-gold text-[8px] font-bold">{getInitials(c.autor?.nome || 'U')}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-text-primary">{c.autor?.nome ?? 'Usuário'}</span>
                            <span className="text-[10px] text-text-secondary">{formatDate(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-text-secondary leading-relaxed bg-surface-elevated/50 rounded-lg p-2.5 border border-border/60">
                            {c.conteudo}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment input */}
                <div className="flex gap-2 pt-1">
                  <textarea
                    rows={2}
                    placeholder="Adicionar comentário..."
                    value={novoComentario}
                    onChange={e => setNovoComentario(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleEnviarComentario() }}
                    className="input flex-1 text-sm resize-none"
                  />
                  <button
                    onClick={handleEnviarComentario}
                    disabled={!novoComentario.trim() || sendingComentario}
                    className="btn-primary px-3 self-end disabled:opacity-40"
                  >
                    {sendingComentario ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Demanda */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-surface border border-border w-full max-w-lg rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border bg-surface-elevated sticky top-0">
              <h2 className="font-display text-lg font-bold text-text-primary">Nova Demanda de Design</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDemand} className="p-4 md:p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase">Título / Job</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Arte para stories — Black Friday"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase">Descrição / Briefing</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="input text-sm resize-none"
                  placeholder="Detalhes do trabalho a ser feito..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase text-gold">Cliente Relacionado</label>
                <select
                  required
                  value={newClienteId}
                  onChange={e => setNewClienteId(e.target.value)}
                  className="input text-sm border-gold/40 focus:border-gold"
                >
                  <option value="">Selecione um cliente...</option>
                  {[...clientes, ...clientesDisponiveis.filter(c => !clientes.find(cc => cc.id === c.id))].map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase">Prazo</label>
                <input
                  type="date"
                  value={newPrazo}
                  onChange={e => setNewPrazo(e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn-ghost text-xs py-2 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs py-2 px-4"
                >
                  {loading ? 'Criando...' : 'Criar Demanda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
