'use client'

import { useState, useCallback, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Calendar, User, Search, X, Trash2 } from 'lucide-react'
import { formatDate, getInitials } from '@/lib/utils'
import type { Tarefa, StatusTarefa, Profile, Projeto } from '@/types'

const colunas: { id: StatusTarefa; label: string; color: string }[] = [
  { id: 'a_fazer', label: 'A Fazer', color: 'border-t-text-secondary' },
  { id: 'em_andamento', label: 'Em Andamento', color: 'border-t-gold' },
  { id: 'concluido', label: 'Concluído', color: 'border-t-success' },
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
}

export default function GlobalKanbanBoard({ tarefasIniciais, membros, projetos, currentUserId }: Props) {
  const normalizarTarefas = useCallback((raw: any[]): ExtendedTarefa[] => {
    return raw.map(t => {
      const ids = t.responsavel_ids || (t.responsavel_id ? [t.responsavel_id] : [])
      const resps = membros.filter(m => ids.includes(m.id))
      return {
        ...t,
        responsavel_ids: ids,
        responsaveis: resps,
        responsavel: resps[0] || null
      }
    })
  }, [membros])

  const [tarefas, setTarefas] = useState<ExtendedTarefa[]>(() => normalizarTarefas(tarefasIniciais))
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMembro, setSelectedMembro] = useState<string>('todos')
  const [selectedCliente, setSelectedCliente] = useState<string>('todos')
  const [onlyMine, setOnlyMine] = useState(false)

  // Clientes únicos a partir dos projetos ou tarefas
  const clientes = useMemo(() => {
    const map = new Map<string, string>()
    projetos.forEach(p => {
      if (p.cliente) {
        map.set(p.cliente.id, p.cliente.nome)
      }
    })
    tarefas.forEach(t => {
      if (t.projeto?.cliente) {
        map.set(t.projeto.cliente.id, t.projeto.cliente.nome)
      }
    })
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [projetos, tarefas])

  // Modals state
  const [editingTarefa, setEditingTarefa] = useState<ExtendedTarefa | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Comments state
  const [comentarios, setComentarios] = useState<any[]>([])
  const [comentariosLoading, setComentariosLoading] = useState(false)
  const [novoComentario, setNovoComentario] = useState('')

  // Create Form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newProjId, setNewProjId] = useState(projetos[0]?.id || '')
  const [newRespIds, setNewRespIds] = useState<string[]>([])
  const [newPrazo, setNewPrazo] = useState('')
  const [newStatus, setNewStatus] = useState<StatusTarefa>('a_fazer')
  const [loading, setLoading] = useState(false)

  // Toggle helpers for multiple responsibles
  const toggleResponsavelEdicao = useCallback((membroId: string) => {
    setEditingTarefa(prev => {
      if (!prev) return null
      const currentIds = prev.responsavel_ids || []
      const newIds = currentIds.includes(membroId)
        ? currentIds.filter(id => id !== membroId)
        : [...currentIds, membroId]
      
      const resps = membros.filter(m => newIds.includes(m.id))
      return {
        ...prev,
        responsavel_ids: newIds,
        responsaveis: resps,
        responsavel: resps[0] || null
      }
    })
  }, [membros])

  const toggleResponsavelCriacao = useCallback((membroId: string) => {
    setNewRespIds(prev =>
      prev.includes(membroId)
        ? prev.filter(id => id !== membroId)
        : [...prev, membroId]
    )
  }, [])

  const abrirDetalhesTarefa = useCallback(async (tarefa: ExtendedTarefa) => {
    setEditingTarefa(tarefa)
    setComentarios([])
    setComentariosLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('comentarios')
      .select('*, autor:profiles(nome, cargo, role)')
      .eq('tarefa_id', tarefa.id)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setComentarios(data)
    }
    setComentariosLoading(false)
  }, [])

  async function handleAddComentario(e: React.FormEvent) {
    e.preventDefault()
    if (!novoComentario.trim() || !editingTarefa) return

    const meuProfile = membros.find(m => m.user_id === currentUserId)
    if (!meuProfile) {
      toast.error('Erro de perfil do usuário logado')
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('comentarios')
      .insert({
        tarefa_id: editingTarefa.id,
        autor_id: meuProfile.id,
        conteudo: novoComentario.trim()
      })
      .select('*, autor:profiles(nome, cargo, role)')
      .single()

    if (error) {
      toast.error('Erro ao adicionar anotação: ' + error.message)
    } else {
      setComentarios(prev => [...prev, data])
      setNovoComentario('')
      toast.success('Anotação registrada!')
    }
  }

  // Filter tasks
  const filteredTarefas = useMemo(() => {
    const meuProfile = membros.find(m => m.user_id === currentUserId)
    const meuProfileId = meuProfile?.id
    return tarefas.filter(t => {
      const matchSearch = t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.descricao && t.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchMembro = selectedMembro === 'todos' || 
                          t.responsavel_id === selectedMembro ||
                          t.responsavel_ids?.includes(selectedMembro)
      const matchCliente = selectedCliente === 'todos' || t.projeto?.cliente?.id === selectedCliente
      const matchMine = !onlyMine || 
                        t.responsavel_id === meuProfileId ||
                        t.responsavel_ids?.includes(meuProfileId || '')

      return matchSearch && matchMembro && matchCliente && matchMine
    })
  }, [tarefas, searchTerm, selectedMembro, selectedCliente, onlyMine, currentUserId, membros])

  const getColItems = (status: StatusTarefa) => {
    return filteredTarefas.filter(t => t.status === status).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
  }

  // Handle Drag End
  const onDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const newStatus = destination.droppableId as StatusTarefa

    // Optimistic update
    setTarefas(prev =>
      prev.map(t =>
        t.id === draggableId ? { ...t, status: newStatus, ordem: destination.index } : t
      )
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('tarefas')
      .update({ status: newStatus, ordem: destination.index })
      .eq('id', draggableId)

    if (error) {
      toast.error('Erro ao mover tarefa')
      // Revert if error
      setTarefas(tarefasIniciais)
    } else {
      toast.success('Tarefa atualizada!')
    }
  }, [tarefasIniciais])

  // Handle Create Task
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newProjId) {
      toast.error('Preencha o título e selecione um projeto')
      return
    }

    setLoading(true)
    const supabase = createClient()
    
    const countInCol = tarefas.filter(t => t.status === newStatus).length

    const { data, error } = await supabase
      .from('tarefas')
      .insert({
        projeto_id: newProjId,
        titulo: newTitle.trim(),
        descricao: newDesc.trim() || null,
        status: newStatus,
        responsavel_id: newRespIds[0] || null,
        responsavel_ids: newRespIds,
        prazo: newPrazo || null,
        ordem: countInCol
      })
      .select('*, projeto:projetos(id, nome, cliente:clientes(nome))')
      .single()

    setLoading(false)

    if (error) {
      toast.error('Erro ao criar tarefa: ' + error.message)
      return
    }

    // Load full responsavel profile locally
    const resps = membros.filter(m => newRespIds.includes(m.id))
    const extendedNewTarefa: ExtendedTarefa = {
      ...data,
      responsavel_ids: newRespIds,
      responsaveis: resps,
      responsavel: resps[0] || null,
    }

    setTarefas(prev => [...prev, extendedNewTarefa])
    setIsCreateOpen(false)
    // Clear form
    setNewTitle('')
    setNewDesc('')
    setNewPrazo('')
    setNewRespIds([])
    toast.success('Demanda criada com sucesso!')
  }

  // Handle Update Task (inside Edit Modal)
  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTarefa) return

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('tarefas')
      .update({
        titulo: editingTarefa.titulo,
        descricao: editingTarefa.descricao || null,
        responsavel_id: editingTarefa.responsavel_ids?.[0] || null,
        responsavel_ids: editingTarefa.responsavel_ids || [],
        prazo: editingTarefa.prazo || null,
        status: editingTarefa.status,
      })
      .eq('id', editingTarefa.id)

    setLoading(false)

    if (error) {
      toast.error('Erro ao atualizar tarefa: ' + error.message)
      return
    }

    const resps = membros.filter(m => (editingTarefa.responsavel_ids || []).includes(m.id))
    const projObj = projetos.find(p => p.id === editingTarefa.projeto_id) || null

    setTarefas(prev =>
      prev.map(t =>
        t.id === editingTarefa.id
          ? {
              ...editingTarefa,
              responsavel_ids: editingTarefa.responsavel_ids || [],
              responsaveis: resps,
              responsavel: resps[0] || null,
              projeto: projObj ? { id: projObj.id, nome: projObj.nome, cliente: projObj.cliente } : null
            }
          : t
      )
    )

    setEditingTarefa(null)
    toast.success('Demanda atualizada com sucesso!')
  }

  // Handle Delete Task
  async function handleDeleteTask(id: string) {
    if (!confirm('Deseja realmente excluir esta demanda?')) return

    const supabase = createClient()
    const { error } = await supabase.from('tarefas').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir tarefa: ' + error.message)
      return
    }

    setTarefas(prev => prev.filter(t => t.id !== id))
    setEditingTarefa(null)
    toast.success('Demanda excluída!')
  }

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-surface border border-border p-4 rounded-lg">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] md:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input
              type="text"
              placeholder="Buscar demanda..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-9 py-1.5 text-sm"
            />
          </div>

          {/* Member Filter */}
          <div className="relative">
            <select
              value={selectedMembro}
              onChange={e => setSelectedMembro(e.target.value)}
              className="input py-1.5 pr-8 text-sm bg-surface-elevated font-medium"
            >
              <option value="todos">Membro: Todos</option>
              {membros.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          {/* Cliente Filter */}
          <div className="relative">
            <select
              value={selectedCliente}
              onChange={e => setSelectedCliente(e.target.value)}
              className="input py-1.5 pr-8 text-sm bg-surface-elevated font-medium"
            >
              <option value="todos">Cliente: Todos</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* My tasks switch */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-text-secondary hover:text-text-primary transition-colors">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={e => setOnlyMine(e.target.checked)}
              className="rounded bg-background border-border text-gold focus:ring-0"
            />
            <span>Minhas Demandas</span>
          </label>
        </div>

        {/* Add demand button */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn-primary flex items-center gap-2 text-sm w-full md:w-auto justify-center py-2"
        >
          <Plus size={16} />
          Nova Demanda
        </button>
      </div>

      {/* Kanban Drag and Drop Grid */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {colunas.map(({ id, label, color }) => {
            const items = getColItems(id)

            return (
              <div key={id} className="flex flex-col gap-3 min-h-[500px]">
                {/* Column Title */}
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      id === 'a_fazer' ? 'bg-text-secondary' : id === 'em_andamento' ? 'bg-gold' : 'bg-success'
                    }`} />
                    <p className="font-display font-medium text-text-primary text-sm uppercase tracking-wider">{label}</p>
                  </div>
                  <span className="text-xs font-semibold text-text-secondary bg-surface-elevated px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>

                {/* Droppable Container */}
                <Droppable droppableId={id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 flex flex-col gap-3 rounded-lg p-2 transition-colors duration-200 ${
                        snapshot.isDraggingOver ? 'bg-surface-elevated/40 border border-dashed border-border' : 'bg-transparent'
                      }`}
                    >
                      {items.map((tarefa, index) => (
                        <Draggable key={tarefa.id} draggableId={tarefa.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => abrirDetalhesTarefa(tarefa)}
                              className={`card p-4 cursor-grab active:cursor-grabbing border-t-2 ${color} ${
                                snapshot.isDragging ? 'shadow-lg border-gold/40 rotate-1 scale-[1.02]' : 'hover:border-gold/30'
                              } transition-all duration-150 space-y-3 bg-surface border border-border`}
                            >
                              <div>
                                {/* Project / Client Tag */}
                                <div className="flex items-center gap-1.5 text-[10px] text-gold font-bold uppercase tracking-wider mb-1">
                                  <span>{tarefa.projeto?.nome || 'Sem Projeto'}</span>
                                  {tarefa.projeto?.cliente?.nome && (
                                    <>
                                      <span className="text-text-secondary">•</span>
                                      <span className="text-text-secondary">{tarefa.projeto.cliente.nome}</span>
                                    </>
                                  )}
                                </div>
                                <h3 className="text-sm font-semibold text-text-primary leading-snug">{tarefa.titulo}</h3>
                                {tarefa.descricao && (
                                  <p className="text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                                    {tarefa.descricao}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-text-secondary pt-2 border-t border-border/50">
                                {/* Due date */}
                                <div className="flex items-center gap-1">
                                  <Calendar size={12} className={tarefa.prazo ? 'text-gold' : 'text-text-secondary'} />
                                  <span>{tarefa.prazo ? formatDate(tarefa.prazo) : 'Sem prazo'}</span>
                                </div>

                                {/* Responsible Stack */}
                                {tarefa.responsaveis && tarefa.responsaveis.length > 0 ? (
                                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                                    {tarefa.responsaveis.slice(0, 3).map((r) => (
                                      <div 
                                        key={r.id}
                                        title={r.nome}
                                        className="w-5 h-5 rounded-full bg-gold-muted border border-surface flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border"
                                      >
                                        {r.avatar_url ? (
                                          <img src={r.avatar_url} alt={r.nome} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[8px] font-bold text-gold">
                                            {getInitials(r.nome)}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {tarefa.responsaveis.length > 3 && (
                                      <span className="text-[8px] font-bold text-text-secondary pl-1">
                                        +{tarefa.responsaveis.length - 3}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-text-secondary opacity-50 italic">Sem atribuição</span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {items.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex-1 flex flex-col items-center justify-center py-16 border border-dashed border-border/50 rounded-lg">
                          <p className="text-text-secondary text-xs opacity-60">Nenhuma demanda aqui</p>
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

      {/* Detail & Edit Modal */}
      {editingTarefa && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl animate-scale-in flex flex-col md:flex-row max-h-[90vh]">
            
            {/* Left Column: Task Fields Form */}
            <form onSubmit={handleUpdateTask} className="flex-1 p-6 border-b md:border-b-0 md:border-r border-border flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-text-primary">Editar Demanda</h2>
                  <div className="flex items-center gap-1.5 text-[10px] text-gold font-bold uppercase tracking-wider">
                    <span>{editingTarefa.projeto?.nome || 'Sem Projeto'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">Título</label>
                  <input
                    type="text"
                    required
                    value={editingTarefa.titulo}
                    onChange={e => setEditingTarefa({ ...editingTarefa, titulo: e.target.value })}
                    className="input text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">Descrição</label>
                  <textarea
                    rows={4}
                    value={editingTarefa.descricao || ''}
                    onChange={e => setEditingTarefa({ ...editingTarefa, descricao: e.target.value })}
                    className="input text-sm resize-none"
                    placeholder="Informações detalhadas sobre a demanda..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Status</label>
                    <select
                      value={editingTarefa.status}
                      onChange={e => setEditingTarefa({ ...editingTarefa, status: e.target.value as StatusTarefa })}
                      className="input text-sm"
                    >
                      <option value="a_fazer">A Fazer</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluido">Concluído</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Prazo</label>
                    <input
                      type="date"
                      value={editingTarefa.prazo || ''}
                      onChange={e => setEditingTarefa({ ...editingTarefa, prazo: e.target.value || null })}
                      className="input text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">Membros Responsáveis</label>
                  <div className="grid grid-cols-2 gap-2 mt-1 max-h-40 overflow-y-auto p-1 border border-border rounded-lg bg-surface-elevated/50">
                    {membros.map(m => {
                      const isSelected = editingTarefa.responsavel_ids?.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleResponsavelEdicao(m.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                            isSelected 
                              ? 'border-gold bg-gold/10 text-text-primary' 
                              : 'border-border bg-surface hover:border-border-hover text-text-secondary'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-gold-muted border border-gold/30 flex items-center justify-center shrink-0 overflow-hidden text-[9px] font-bold">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt={m.nome} className="w-full h-full object-cover" />
                            ) : (
                              getInitials(m.nome)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate leading-tight">{m.nome.split(' ')[0]} {m.nome.split(' ')[1] || ''}</p>
                            <p className="text-[9px] text-text-secondary truncate leading-none capitalize mt-0.5">{m.cargo || m.role.replace(/_/g, ' ')}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => handleDeleteTask(editingTarefa.id)}
                  className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
                >
                  <Trash2 size={14} />
                  Excluir
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTarefa(null)}
                    className="btn-ghost text-xs py-2 px-4"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary text-xs py-2 px-4"
                  >
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>

            {/* Right Column: Annotations / Comments Section */}
            <div className="w-full md:w-[380px] p-6 bg-surface-elevated flex flex-col justify-between overflow-hidden h-[400px] md:h-auto">
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <h3 className="font-display text-sm font-bold text-text-primary">Anotações da Demanda</h3>
                  <button onClick={() => setEditingTarefa(null)} className="text-text-secondary hover:text-text-primary md:hidden">
                    <X size={18} />
                  </button>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {comentariosLoading ? (
                    <div className="h-full flex items-center justify-center py-10">
                      <p className="text-xs text-text-secondary animate-pulse">Carregando anotações...</p>
                    </div>
                  ) : comentarios.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-xs text-text-secondary opacity-60">Sem anotações ainda.</p>
                      <p className="text-[10px] text-text-secondary opacity-40 mt-0.5">Use o campo abaixo para fazer anotações de equipe.</p>
                    </div>
                  ) : (
                    comentarios.map((c) => (
                      <div key={c.id} className="p-3 rounded bg-surface border border-border/60 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-gold">{c.autor?.nome || 'Usuário'}</span>
                          <span className="text-text-secondary">{formatDate(c.created_at)}</span>
                        </div>
                        <p className="text-text-primary whitespace-pre-line leading-relaxed">{c.conteudo}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Comment Input Form */}
              <form onSubmit={handleAddComentario} className="border-t border-border pt-4 mt-4 space-y-2">
                <textarea
                  required
                  rows={2}
                  value={novoComentario}
                  onChange={e => setNovoComentario(e.target.value)}
                  className="input text-xs resize-none py-2 bg-background border-border/80"
                  placeholder="Adicione uma anotação importante..."
                />
                <button
                  type="submit"
                  className="btn-primary w-full text-xs py-1.5"
                >
                  Registrar Anotação
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
              <h2 className="font-display text-lg font-bold text-text-primary">Nova Demanda</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase">Título da Demanda</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Criar carrossel para Instagram..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase">Descrição</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="input text-sm resize-none"
                  placeholder="Instruções sobre o conteúdo, referências, etc."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase text-gold">Projeto Relacionado</label>
                <select
                  required
                  value={newProjId}
                  onChange={e => setNewProjId(e.target.value)}
                  className="input text-sm border-gold/40 focus:border-gold"
                >
                  {projetos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.cliente?.nome ? `(${p.cliente.nome})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">Status Inicial</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as StatusTarefa)}
                    className="input text-sm"
                  >
                    <option value="a_fazer">A Fazer</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluido">Concluído</option>
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
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase">Membros Responsáveis</label>
                <div className="grid grid-cols-2 gap-2 mt-1 max-h-40 overflow-y-auto p-1 border border-border rounded-lg bg-surface-elevated/50">
                  {membros.map(m => {
                    const isSelected = newRespIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleResponsavelCriacao(m.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? 'border-gold bg-gold/10 text-text-primary' 
                            : 'border-border bg-surface hover:border-border-hover text-text-secondary'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-gold-muted border border-gold/30 flex items-center justify-center shrink-0 overflow-hidden text-[9px] font-bold">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt={m.nome} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(m.nome)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate leading-tight">{m.nome.split(' ')[0]} {m.nome.split(' ')[1] || ''}</p>
                          <p className="text-[9px] text-text-secondary truncate leading-none capitalize mt-0.5">{m.cargo || m.role.replace(/_/g, ' ')}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action buttons */}
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
