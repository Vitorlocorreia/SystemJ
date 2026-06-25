'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Calendar, User, X, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Tarefa, StatusTarefa, Profile } from '@/types'

const colunas: { id: StatusTarefa; label: string; color: string }[] = [
  { id: 'a_fazer', label: 'A Fazer', color: 'border-t-text-secondary' },
  { id: 'em_andamento', label: 'Em Andamento', color: 'border-t-gold' },
  { id: 'concluido', label: 'Concluído', color: 'border-t-success' },
]

interface Props {
  tarefasIniciais: (Tarefa & { responsavel: Profile | null })[]
  projetoId: string
  membros: Profile[]
  currentUserId: string
}

export default function KanbanBoard({ tarefasIniciais, projetoId, membros, currentUserId }: Props) {
  const [tarefas, setTarefas] = useState(tarefasIniciais)
  const [addingTo, setAddingTo] = useState<StatusTarefa | null>(null)
  const [novoTitulo, setNovoTitulo] = useState('')

  // Detail Modal & Comments state
  const [editingTarefa, setEditingTarefa] = useState<(Tarefa & { responsavel: Profile | null }) | null>(null)
  const [comentarios, setComentarios] = useState<any[]>([])
  const [comentariosLoading, setComentariosLoading] = useState(false)
  const [novoComentario, setNovoComentario] = useState('')
  const [loading, setLoading] = useState(false)

  const byStatus = (status: StatusTarefa) =>
    tarefas.filter(t => t.status === status).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))

  // Open Details Modal & Load comments
  const abrirDetalhesTarefa = useCallback(async (tarefa: typeof tarefas[0]) => {
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

  // Handle drag and drop
  const onDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const newStatus = destination.droppableId as StatusTarefa

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
      setTarefas(tarefasIniciais)
    } else {
      toast.success('Tarefa atualizada!')
    }
  }, [tarefasIniciais])

  // Create Task Inline
  async function addTarefa(status: StatusTarefa) {
    if (!novoTitulo.trim()) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('tarefas')
      .insert({
        projeto_id: projetoId,
        titulo: novoTitulo.trim(),
        status,
        ordem: byStatus(status).length
      })
      .select('*')
      .single()

    if (error) {
      toast.error('Erro ao criar tarefa')
      return
    }

    setTarefas(prev => [...prev, { ...data, responsavel: null }])
    setNovoTitulo('')
    setAddingTo(null)
    toast.success('Tarefa criada!')
  }

  // Update Task Form
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
        responsavel_id: editingTarefa.responsavel_id || null,
        prazo: editingTarefa.prazo || null,
        status: editingTarefa.status,
      })
      .eq('id', editingTarefa.id)

    setLoading(false)

    if (error) {
      toast.error('Erro ao atualizar tarefa: ' + error.message)
      return
    }

    const respObj = membros.find(m => m.id === editingTarefa.responsavel_id) || null

    setTarefas(prev =>
      prev.map(t =>
        t.id === editingTarefa.id
          ? { ...editingTarefa, responsavel: respObj }
          : t
      )
    )

    setEditingTarefa(null)
    toast.success('Tarefa atualizada!')
  }

  // Delete Task
  async function handleDeleteTask(id: string) {
    if (!confirm('Deseja realmente excluir esta tarefa?')) return

    const supabase = createClient()
    const { error } = await supabase.from('tarefas').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir tarefa: ' + error.message)
      return
    }

    setTarefas(prev => prev.filter(t => t.id !== id))
    setEditingTarefa(null)
    toast.success('Tarefa excluída!')
  }

  // Add Annotation / Comment
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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {colunas.map(({ id, label, color }) => {
          const items = byStatus(id)

          return (
            <div key={id} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    id === 'a_fazer' ? 'bg-text-secondary' : id === 'em_andamento' ? 'bg-gold' : 'bg-success'
                  }`} />
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary bg-surface-elevated px-2 py-0.5 rounded-full">{items.length}</span>
                  <button
                    onClick={() => { setAddingTo(id); setNovoTitulo('') }}
                    className="text-text-secondary hover:text-gold transition-colors duration-150"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Add task form inline */}
              {addingTo === id && (
                <div className="card-elevated p-3 space-y-2 animate-fade-in">
                  <input
                    autoFocus
                    value={novoTitulo}
                    onChange={e => setNovoTitulo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTarefa(id); if (e.key === 'Escape') setAddingTo(null) }}
                    placeholder="Título da tarefa..."
                    className="input text-xs py-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => addTarefa(id)} className="btn-primary text-xs py-1.5 px-3">Criar</button>
                    <button onClick={() => setAddingTo(null)} className="btn-ghost text-xs py-1.5 px-3">Cancelar</button>
                  </div>
                </div>
              )}

              {/* Droppable column */}
              <Droppable droppableId={id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 flex flex-col gap-2 min-h-[120px] rounded-lg p-1.5 transition-colors duration-150 ${
                      snapshot.isDraggingOver ? 'bg-surface-elevated' : ''
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
                            className={`card p-3.5 cursor-grab active:cursor-grabbing transition-all duration-150 ${
                              snapshot.isDragging
                                ? 'border-gold/50 shadow-gold rotate-1 scale-105'
                                : 'hover:border-gold/30'
                            } border-t-2 ${color}`}
                          >
                            <p className="text-sm font-medium text-text-primary leading-tight mb-2">{tarefa.titulo}</p>

                            <div className="flex items-center justify-between gap-2 text-xs text-text-secondary">
                              {tarefa.prazo && (
                                <span className="flex items-center gap-1">
                                  <Calendar size={10} />
                                  {formatDate(tarefa.prazo)}
                                </span>
                              )}
                              {tarefa.responsavel && (
                                <span className="flex items-center gap-1 truncate">
                                  <User size={10} />
                                  {tarefa.responsavel.nome.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {items.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex-1 flex items-center justify-center py-8">
                        <p className="text-text-secondary text-xs opacity-50">Arraste aqui</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>

      {/* Detail & Edit Modal with Comments */}
      {editingTarefa && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl animate-scale-in flex flex-col md:flex-row max-h-[90vh]">
            
            {/* Left Column: Edit Fields Form */}
            <form onSubmit={handleUpdateTask} className="flex-1 p-6 border-b md:border-b-0 md:border-r border-border flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <h2 className="font-display text-lg font-bold text-text-primary">Editar Demanda</h2>

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
                  <label className="text-xs font-semibold text-text-secondary uppercase">Responsável</label>
                  <select
                    value={editingTarefa.responsavel_id || ''}
                    onChange={e => setEditingTarefa({ ...editingTarefa, responsavel_id: e.target.value || null })}
                    className="input text-sm"
                  >
                    <option value="">Sem atribuição</option>
                    {membros.map(m => (
                      <option key={m.id} value={m.id}>{m.nome} ({m.cargo})</option>
                    ))}
                  </select>
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

            {/* Right Column: Comments / Annotations Section */}
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
                      <p className="text-[10px] text-text-secondary opacity-40 mt-0.5">Use o campo abaixo para registrar anotações.</p>
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

              {/* Comment Form */}
              <form onSubmit={handleAddComentario} className="border-t border-border pt-4 mt-4 space-y-2">
                <textarea
                  required
                  rows={2}
                  value={novoComentario}
                  onChange={e => setNovoComentario(e.target.value)}
                  className="input text-xs resize-none py-2 bg-background border-border/80"
                  placeholder="Adicione uma anotação..."
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
    </DragDropContext>
  )
}
