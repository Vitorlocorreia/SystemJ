'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Calendar, User, Search, X, Trash2, ArrowLeft, ArrowRight, Share2, Clipboard, HelpCircle, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Tarefa, StatusTarefa, Profile, ClientePublico } from '@/types'

// Days of the week config
const DIAS_SEMANA = [
  { key: 'segunda', label: 'Segunda-feira', offset: 0 },
  { key: 'terca', label: 'Terça-feira', offset: 1 },
  { key: 'quarta', label: 'Quarta-feira', offset: 2 },
  { key: 'quinta', label: 'Quinta-feira', offset: 3 },
  { key: 'sexta', label: 'Sexta-feira', offset: 4 },
  { key: 'sabado', label: 'Sábado', offset: 5 },
  { key: 'domingo', label: 'Domingo', offset: 6 },
]

interface ExtendedTarefa extends Tarefa {
  responsavel: Profile | null
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
  clientes: ClientePublico[]
  currentUserId: string
  isGestor: boolean
}

// Vanilla Date Helpers
function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatYYYYMMDD(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDDMM(date: Date) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

export default function WeeklyPlanner({ tarefasIniciais, membros, clientes, currentUserId, isGestor }: Props) {
  const [tarefas, setTarefas] = useState<ExtendedTarefa[]>(tarefasIniciais)
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()))

  const meuProfile = useMemo(() => membros.find(m => m.user_id === currentUserId), [membros, currentUserId])
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMembro, setSelectedMembro] = useState<string>('todos')
  const [selectedCliente, setSelectedCliente] = useState<string>('todos')

  // Modals state
  const [editingTarefa, setEditingTarefa] = useState<ExtendedTarefa | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [minhasDemandasExpanded, setMinhasDemandasExpanded] = useState(false)

  // Comments state
  const [comentarios, setComentarios] = useState<any[]>([])
  const [comentariosLoading, setComentariosLoading] = useState(false)
  const [novoComentario, setNovoComentario] = useState('')
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false)

  // Create Form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newClienteId, setNewClienteId] = useState(clientes[0]?.id || '')
  const [newRespId, setNewRespId] = useState<string>('')
  const [newPrazo, setNewPrazo] = useState('')
  const [newHorarioInicio, setNewHorarioInicio] = useState('')
  const [loading, setLoading] = useState(false)

  // Export state
  const [exportMembro, setExportMembro] = useState<string>('todos')

  // Computed permissions (must be after editingTarefa declaration)
  const isResponsavel = !!(editingTarefa && meuProfile && editingTarefa.responsavel_id === meuProfile.id)
  const canModifyTask = isGestor || isResponsavel

  // Calculate dates of current week
  const weekDates = useMemo(() => {
    return DIAS_SEMANA.map(d => {
      const date = addDays(currentWeekMonday, d.offset)
      return {
        ...d,
        date,
        dateStr: formatYYYYMMDD(date),
        labelWithDate: `${d.label} (${formatDDMM(date)})`,
      }
    })
  }, [currentWeekMonday])

  // Navigate weeks
  const prevWeek = () => setCurrentWeekMonday(prev => addDays(prev, -7))
  const nextWeek = () => setCurrentWeekMonday(prev => addDays(prev, 7))
  const todayWeek = () => setCurrentWeekMonday(getMonday(new Date()))

  // Filtered tasks
  const filteredTarefas = useMemo(() => {
    return tarefas.filter(t => {
      const matchSearch = t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.descricao && t.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchMembro = selectedMembro === 'todos' || t.responsavel_id === selectedMembro
      const matchCliente = selectedCliente === 'todos' || t.projeto?.cliente?.id === selectedCliente

      return matchSearch && matchMembro && matchCliente
    })
  }, [tarefas, searchTerm, selectedMembro, selectedCliente])

  // Get current user's demands
  const minhasDemandas = useMemo(() => {
    return tarefas.filter(t => {
      const isMine = t.responsavel_id === meuProfile?.id
      if (!isMine) return false
      
      const isBacklog = !t.prazo
      const isInCurrentWeek = weekDates.some(d => d.dateStr === t.prazo)
      
      return isBacklog || isInCurrentWeek
    })
  }, [tarefas, meuProfile, weekDates])

  // Get tasks for a specific day — sorted by start time (nulls last)
  const getTasksForDay = (dateStr: string) => {
    return filteredTarefas.filter(t => t.prazo === dateStr).sort((a, b) => {
      if (!a.horario_inicio && !b.horario_inicio) return (a.ordem || 0) - (b.ordem || 0)
      if (!a.horario_inicio) return 1
      if (!b.horario_inicio) return -1
      return a.horario_inicio.localeCompare(b.horario_inicio)
    })
  }

  // Get tasks in the Backlog (unscheduled)
  const getBacklogTasks = () => {
    return filteredTarefas.filter(t => !t.prazo).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
  }

  // Load comments
  const abrirDetalhesTarefa = useCallback(async (tarefa: ExtendedTarefa) => {
    setEditingTarefa(tarefa)
    setComentarios([])
    setComentariosLoading(true)
    setIsAnnotationsOpen(false)

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

  // Handle Drag & Drop
  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!isGestor) return
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const destColId = destination.droppableId // 'backlog' or YYYY-MM-DD
    const newPrazoValue = destColId === 'backlog' ? null : destColId

    // Optimistic update
    setTarefas(prev =>
      prev.map(t =>
        t.id === draggableId ? { ...t, prazo: newPrazoValue, ordem: destination.index } : t
      )
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('tarefas')
      .update({ prazo: newPrazoValue, ordem: destination.index })
      .eq('id', draggableId)

    if (error) {
      toast.error('Erro ao mover demanda')
      setTarefas(tarefasIniciais)
    } else {
      toast.success('Agenda atualizada!')
    }
  }, [tarefasIniciais, isGestor])

  // Helper to get or create project for client
  async function getOrCreateProjectForClient(supabase: any, clienteId: string): Promise<string | null> {
    const { data: proj } = await supabase
      .from('projetos')
      .select('id')
      .eq('cliente_id', clienteId)
      .limit(1)
      .maybeSingle()

    if (proj?.id) return proj.id

    // Fetch client details
    const { data: cli } = await supabase
      .from('clientes')
      .select('nome')
      .eq('id', clienteId)
      .single()

    const clientName = cli?.nome || 'Cliente'

    // Create new default project for client
    const { data: newProj, error } = await supabase
      .from('projetos')
      .insert({
        nome: `Mesa - ${clientName}`,
        cliente_id: clienteId,
        status: 'em_andamento'
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating project for client', error)
      return null
    }

    return newProj.id
  }

  // Handle Create Demand
  async function handleCreateDemand(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newClienteId) {
      toast.error('Preencha o título e selecione um cliente')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const projId = await getOrCreateProjectForClient(supabase, newClienteId)
    if (!projId) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('tarefas')
      .insert({
        projeto_id: projId,
        titulo: newTitle.trim(),
        descricao: newDesc.trim() || null,
        status: 'a_fazer' as StatusTarefa,
        responsavel_id: newRespId || null,
        prazo: newPrazo || null,
        horario_inicio: newHorarioInicio || null,
        ordem: 0
      })
      .select('*, projeto:projetos(id, nome, cliente:clientes(id, nome))')
      .single()

    setLoading(false)

    if (error) {
      toast.error('Erro ao criar demanda: ' + error.message)
      return
    }

    const respObj = membros.find(m => m.id === newRespId) || null
    const extendedNewTarefa: ExtendedTarefa = {
      ...data,
      responsavel: respObj,
    }

    setTarefas(prev => [...prev, extendedNewTarefa])
    setIsCreateOpen(false)
    setNewTitle('')
    setNewDesc('')
    setNewPrazo('')
    setNewHorarioInicio('')
    setNewRespId('')
    toast.success('Demanda agendada com sucesso!')
  }


  // Handle Update Demand
  async function handleUpdateDemand(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTarefa) return

    const isResponsavel = meuProfile && editingTarefa.responsavel_id === meuProfile.id
    const canModify = isGestor || isResponsavel

    if (!canModify) {
      toast.error('Você não tem permissão para alterar esta demanda.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('tarefas')
      .update({
        titulo: editingTarefa.titulo,
        descricao: editingTarefa.descricao || null,
        responsavel_id: editingTarefa.responsavel_id || null,
        prazo: editingTarefa.prazo || null,
        horario_inicio: editingTarefa.horario_inicio || null,
        status: editingTarefa.status,
        horario_conclusao: editingTarefa.horario_conclusao || null,
      })
      .eq('id', editingTarefa.id)

    setLoading(false)

    if (error) {
      toast.error('Erro ao atualizar demanda: ' + error.message)
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
    toast.success('Demanda atualizada!')
  }

  // Handle Delete Demand
  async function handleDeleteDemand(id: string) {
    if (!isGestor) return
    if (!confirm('Deseja realmente excluir esta demanda?')) return

    const supabase = createClient()
    const { error } = await supabase.from('tarefas').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir demanda: ' + error.message)
      return
    }

    setTarefas(prev => prev.filter(t => t.id !== id))
    setEditingTarefa(null)
    toast.success('Demanda excluída!')
  }

  // Add Annotation
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

  // WhatsApp Exporter Text Generator
  const whatsappText = useMemo(() => {
    let text = `🗓️ *AGENDA DA SEMANA - JOTA ESPORTIVO*\n`
    text += `De *${formatDDMM(currentWeekMonday)}* a *${formatDDMM(addDays(currentWeekMonday, 6))}*\n\n`

    const selectedMembroObj = membros.find(m => m.id === exportMembro)
    if (selectedMembroObj) {
      text = `🗓️ *AGENDA DA SEMANA - ${selectedMembroObj.nome.toUpperCase()}*\n`
      text += `De *${formatDDMM(currentWeekMonday)}* a *${formatDDMM(addDays(currentWeekMonday, 6))}*\n\n`
    }

    weekDates.forEach(day => {
      const dayTasks = tarefas.filter(t => t.prazo === day.dateStr)
      const dayFilteredTasks = dayTasks.filter(t => {
        return exportMembro === 'todos' || t.responsavel_id === exportMembro
      })

      text += `*${day.label} (${formatDDMM(day.date)})*\n`
      if (dayFilteredTasks.length === 0) {
        text += `_Sem captações/demandas agendadas_\n\n`
      } else {
        dayFilteredTasks.forEach(t => {
          const resp = t.responsavel?.nome ? `[${t.responsavel.nome.split(' ')[0]}] ` : ''
          const cli = t.projeto?.cliente?.nome ? `(${t.projeto.cliente.nome})` : 'Sem Cliente'
          const hora = t.horario_inicio ? ` 🕐 ${t.horario_inicio.slice(0, 5)}` : ''
          text += `• ${resp}${t.titulo} ${cli}${hora}\n`
        })
        text += `\n`
      }
    })

    return text.trim()
  }, [currentWeekMonday, weekDates, tarefas, exportMembro, membros])

  const handleCopyWhatsAppText = () => {
    navigator.clipboard.writeText(whatsappText)
    toast.success('Agenda copiada para a área de transferência! Cole no WhatsApp.')
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header and Exporter Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-display-md text-text-primary">Agenda Semanal</h1>
          <p className="text-sm text-text-secondary mt-1 hidden sm:block">
            Planeje o cronograma semanal de captações de filmmakers e entregas da agência.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isGestor && (
            <button
              onClick={() => setIsExportOpen(true)}
              className="btn-secondary flex items-center gap-2 text-sm justify-center py-2"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">Exportar Semana (WhatsApp)</span>
              <span className="sm:hidden">WhatsApp</span>
            </button>
          )}
          {isGestor && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-primary flex items-center gap-2 text-sm justify-center py-2"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nova Demanda</span>
              <span className="sm:hidden">Nova</span>
            </button>
          )}
        </div>
      </div>

      {/* Mini Dashboard / Minhas Demandas */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-4 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-stretch gap-4">
          {/* Total Demands Card */}
          {isGestor && (
            <div className="flex-1 bg-surface-elevated/40 border border-border/60 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Demandas na Semana</p>
                <p className="font-display text-3xl font-bold text-text-primary mt-2">{filteredTarefas.length} total</p>
              </div>
              <p className="text-[10px] text-text-secondary mt-1.5">Cronograma geral da equipe.</p>
            </div>
          )}

          {/* My Demands Card */}
          <button
            type="button"
            onClick={() => setMinhasDemandasExpanded(!minhasDemandasExpanded)}
            className="flex-1 bg-surface-elevated/40 border border-border/60 rounded-xl p-4 text-left hover:border-gold/30 transition-all duration-150 group flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest group-hover:text-gold transition-colors">Minhas Demandas</span>
              <span className="text-[9px] bg-gold-muted text-gold border border-gold/20 px-1.5 py-0.5 rounded font-bold">
                {minhasDemandas.length}
              </span>
            </div>
            <p className="font-display text-3xl font-bold text-gold mt-2">
              {minhasDemandas.length} atribuídas
            </p>
            <span className="text-[10px] text-gold font-sans font-medium group-hover:underline mt-1.5">
              {minhasDemandasExpanded ? '▲ Recolher lista' : '▼ Clique para abrir a lista'}
            </span>
          </button>
        </div>

        {/* Accordion List */}
        {minhasDemandasExpanded && (
          <div className="border-t border-border/60 pt-3 animate-slide-in space-y-2.5">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Suas tarefas nesta semana:</h3>
            {minhasDemandas.length === 0 ? (
              <p className="text-xs text-text-secondary italic">Você não tem demandas atribuídas nesta semana.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {minhasDemandas.map(t => {
                  const dayObj = weekDates.find(d => d.dateStr === t.prazo)
                  const dayLabel = dayObj ? `${dayObj.label.slice(0, 3)} (${formatDDMM(dayObj.date)})` : 'Fila / Backlog'

                  return (
                    <div
                      key={t.id}
                      onClick={() => abrirDetalhesTarefa(t)}
                      className="p-3.5 rounded-xl bg-surface-elevated/40 hover:bg-surface-elevated border border-border/60 hover:border-gold/30 transition-all cursor-pointer flex items-center justify-between gap-3 text-left group"
                    >
                      <div>
                        <span className="text-[9px] text-text-secondary font-bold block mb-0.5 uppercase tracking-wider">
                          {dayLabel} {t.horario_inicio ? ` - ${t.horario_inicio.slice(0, 5)}` : ''}
                        </span>
                        <p className="text-xs font-semibold text-text-primary group-hover:text-gold transition-colors">{t.titulo}</p>
                        <span className="text-[9px] text-gold font-medium uppercase tracking-wider">
                          {t.projeto?.cliente?.nome || 'Sem Cliente'}
                        </span>
                      </div>
                      <span className="badge-secondary text-[10px] capitalize shrink-0">{t.status.replace(/_/g, ' ')}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Week Navigator & Filters */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-surface border border-border p-4 rounded-lg">
        {/* Navigation */}
        <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
          <div className="flex items-center gap-1.5">
            <button onClick={prevWeek} className="btn-ghost p-1.5 rounded-lg">
              <ArrowLeft size={16} />
            </button>
            <button onClick={todayWeek} className="btn-secondary text-xs px-2.5 py-1">
              Hoje
            </button>
            <button onClick={nextWeek} className="btn-ghost p-1.5 rounded-lg">
              <ArrowRight size={16} />
            </button>
          </div>
          <span className="font-display text-sm font-bold text-text-primary">
            Semana de {formatDDMM(currentWeekMonday)} a {formatDDMM(addDays(currentWeekMonday, 6))}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] xl:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
            <input
              type="text"
              placeholder="Buscar demanda..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-9 py-1 text-xs"
            />
          </div>

          {/* Member Filter */}
          <select
            value={selectedMembro}
            onChange={e => setSelectedMembro(e.target.value)}
            className="input py-1 pr-8 text-xs bg-surface-elevated font-medium"
          >
            <option value="todos">Membro: Todos</option>
            {membros.map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>

          {/* Client Filter */}
          <select
            value={selectedCliente}
            onChange={e => setSelectedCliente(e.target.value)}
            className="input py-1 pr-8 text-xs bg-surface-elevated font-medium"
          >
            <option value="todos">Cliente: Todos</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Drag & Drop Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-4 overflow-x-auto pb-4">
          {/* On mobile: show backlog collapsed; on desktop: side by side */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">

          {/* Backlog sidebar */}
          <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2 bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-warning/80" />
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.12em]">Fila de Entrada</p>
              </div>
              <span className="text-[10px] font-bold text-text-secondary bg-surface-elevated px-1.5 py-0.5 rounded-full">
                {getBacklogTasks().length}
              </span>
            </div>

            <Droppable droppableId="backlog">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 flex flex-col gap-1.5 min-h-[200px] p-2 transition-colors ${
                    snapshot.isDraggingOver ? 'bg-warning/5' : ''
                  }`}
                >
                  {getBacklogTasks().map((tarefa, index) => (
                    <Draggable key={tarefa.id} draggableId={tarefa.id} index={index} isDragDisabled={!isGestor}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => abrirDetalhesTarefa(tarefa)}
                          className={`rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-150 border ${
                            snapshot.isDragging ? 'shadow-xl scale-[1.03] rotate-1 opacity-95' : 'hover:border-warning/50'
                          } border-border/50`}
                        >
                          <div className="h-0.5 bg-warning/60 w-full" />
                          <div className="px-2.5 py-2 bg-surface-elevated">
                            <span className="text-[9px] text-warning/80 font-bold uppercase tracking-wider block mb-0.5 truncate">
                              {tarefa.projeto?.cliente?.nome || 'Sem Data'}
                            </span>
                            <p className="text-xs font-medium text-text-primary leading-snug line-clamp-2">{tarefa.titulo}</p>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {getBacklogTasks().length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border/40 rounded-lg py-8 mx-1">
                      <p className="text-[10px] text-text-secondary opacity-40">Arraste aqui</p>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>

          {/* Calendar Days Grid — horizontal scroll on mobile */}
          <div className="flex-1 min-w-0 overflow-x-auto -mx-1 px-1">
            <div className="grid grid-cols-7 gap-2 min-w-[700px] xl:min-w-0">
            {weekDates.map(day => {
              const dayTasks = getTasksForDay(day.dateStr)
              const isToday = day.dateStr === formatYYYYMMDD(new Date())

              return (
                <div
                  key={day.key}
                  className={`flex flex-col rounded-xl border overflow-hidden ${
                    isToday
                      ? 'border-gold/30 bg-gold/5'
                      : 'border-border bg-surface'
                  }`}
                >
                  {/* Calendar Day Header */}
                  <div className={`text-center px-2 pt-3 pb-2.5 border-b ${
                    isToday ? 'border-gold/20' : 'border-border'
                  }`}>
                    <p className={`text-[9px] font-bold uppercase tracking-[0.15em] mb-1 ${
                      isToday ? 'text-gold/80' : 'text-text-secondary'
                    }`}>
                      {day.label.slice(0, 3)}
                    </p>
                    <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-sm font-bold font-display ${
                      isToday
                        ? 'bg-gold text-background'
                        : 'text-text-primary'
                    }`}>
                      {day.date.getDate()}
                    </div>
                    {dayTasks.length > 0 && (
                      <div className={`mt-1.5 text-[9px] font-semibold ${
                        isToday ? 'text-gold/60' : 'text-text-secondary/50'
                      }`}>
                        {dayTasks.length} {dayTasks.length === 1 ? 'demanda' : 'demandas'}
                      </div>
                    )}
                  </div>

                  {/* Droppable event area */}
                  <Droppable droppableId={day.dateStr}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 flex flex-col gap-1.5 p-2 min-h-[320px] transition-colors ${
                          snapshot.isDraggingOver
                            ? isToday ? 'bg-gold/10' : 'bg-surface-elevated/60'
                            : ''
                        }`}
                      >
                        {dayTasks.map((tarefa, index) => (
                          <Draggable key={tarefa.id} draggableId={tarefa.id} index={index} isDragDisabled={!isGestor}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => abrirDetalhesTarefa(tarefa)}
                                className={`rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-150 border ${
                                  snapshot.isDragging
                                    ? 'shadow-xl scale-[1.04] rotate-1 opacity-95'
                                    : 'hover:border-gold/40'
                                } border-border/50`}
                              >
                                {/* Time strip — só aparece se tiver horário */}
                                {tarefa.horario_inicio ? (
                                  <div className="bg-gold/15 border-b border-gold/20 px-2 py-1 flex items-center gap-1">
                                    <span className="text-[10px] font-mono font-bold text-gold leading-none">
                                      {tarefa.horario_inicio.slice(0, 5)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="h-0.5 bg-gold/30 w-full" />
                                )}
                                {/* Event body */}
                                <div className="px-2.5 py-2 bg-surface-elevated">
                                  <span className="text-[9px] text-text-secondary/70 font-semibold uppercase tracking-wider block mb-0.5 truncate">
                                    {tarefa.projeto?.cliente?.nome || 'Sem Cliente'}
                                  </span>
                                  <p className="text-xs font-medium text-text-primary leading-snug line-clamp-2">{tarefa.titulo}</p>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {dayTasks.length === 0 && (
                          <div className="flex-1 flex items-center justify-center">
                            <p className="text-[9px] text-text-secondary opacity-20">—</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
            </div>
          </div>
          </div>
        </div>
      </DragDropContext>

      {/* Details & Annotations Modal */}
      {editingTarefa && (
        <>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-surface border border-border w-full max-w-4xl rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl animate-scale-in flex flex-col md:flex-row h-[92vh] sm:max-h-[90vh]">
            
            {/* Left Column: Form Fields */}
            <form onSubmit={handleUpdateDemand} className="flex-1 p-4 md:p-6 border-b md:border-b-0 md:border-r border-border flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <h2 className="font-display text-lg font-bold text-text-primary">Detalhes da Demanda</h2>
                    <span className="text-[10px] text-gold font-bold uppercase tracking-wider">
                      {editingTarefa.projeto?.cliente?.nome || 'Sem Cliente'}
                    </span>
                  </div>
                  
                  {/* Annotations Trigger Button for Mobile */}
                  <button
                    type="button"
                    onClick={() => setIsAnnotationsOpen(true)}
                    className="relative md:hidden flex items-center gap-1.5 bg-surface-elevated hover:bg-surface-elevated/80 border border-border px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary transition-all duration-200"
                  >
                    <MessageSquare size={14} className="text-gold" />
                    <span>Anotações</span>
                    {comentarios.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger/80 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-danger items-center justify-center text-[9px] font-bold text-white">
                          {comentarios.length}
                        </span>
                      </span>
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">Título</label>
                  <input
                    type="text"
                    required
                    disabled={!isGestor}
                    value={editingTarefa.titulo}
                    onChange={e => setEditingTarefa({ ...editingTarefa, titulo: e.target.value })}
                    className="input text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">Descrição / Instruções</label>
                  <textarea
                    rows={4}
                    disabled={!isGestor}
                    value={editingTarefa.descricao || ''}
                    onChange={e => setEditingTarefa({ ...editingTarefa, descricao: e.target.value })}
                    className="input text-sm resize-none"
                    placeholder="Instruções para o filmmaker sobre o estilo da captação ou entrega..."
                  />
                </div>

                 <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Status</label>
                    <select
                      value={editingTarefa.status}
                      disabled={!canModifyTask}
                      onChange={e => {
                        const newStatus = e.target.value as StatusTarefa
                        let updatedHorarioConclusao = editingTarefa.horario_conclusao
                        
                        if (newStatus === 'concluido' && !updatedHorarioConclusao) {
                          const now = new Date()
                          updatedHorarioConclusao = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                        } else if (newStatus !== 'concluido') {
                          updatedHorarioConclusao = null
                        }
                        
                        setEditingTarefa({
                          ...editingTarefa,
                          status: newStatus,
                          horario_conclusao: updatedHorarioConclusao
                        })
                      }}
                      className="input text-sm"
                    >
                      <option value="a_fazer">A Fazer</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluido">Concluído</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Data Programada</label>
                    <input
                      type="date"
                      disabled={!isGestor}
                      value={editingTarefa.prazo || ''}
                      onChange={e => setEditingTarefa({ ...editingTarefa, prazo: e.target.value || null })}
                      className="input text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">⏰ Horário de Início</label>
                  <input
                    type="time"
                    disabled={!isGestor}
                    value={editingTarefa.horario_inicio || ''}
                    onChange={e => setEditingTarefa({ ...editingTarefa, horario_inicio: e.target.value || null })}
                    className="input text-sm"
                    placeholder="Ex: 08:00"
                  />
                </div>

                {editingTarefa.status === 'concluido' && (
                  <div className="space-y-1 animate-fade-in">
                    <label className="text-xs font-semibold text-text-secondary uppercase">✅ Horário de Conclusão</label>
                    <input
                      type="time"
                      disabled={!canModifyTask}
                      required
                      value={editingTarefa.horario_conclusao || ''}
                      onChange={e => setEditingTarefa({ ...editingTarefa, horario_conclusao: e.target.value || null })}
                      className="input text-sm border-gold/40 focus:border-gold"
                    />
                  </div>
                )}
                 <div className="space-y-1">
                   <label className="text-xs font-semibold text-text-secondary uppercase">Membro Responsável</label>
                  <select
                    value={editingTarefa.responsavel_id || ''}
                    disabled={!isGestor}
                    onChange={e => setEditingTarefa({ ...editingTarefa, responsavel_id: e.target.value || null })}
                    className="input text-sm"
                  >
                    <option value="">Sem atribuição</option>
                    {membros.map(m => (
                      <option key={m.id} value={m.id}>{m.nome} ({m.cargo || m.role.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
                {isGestor && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDemand(editingTarefa.id)}
                    className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
                  >
                    <Trash2 size={14} />
                    Excluir
                  </button>
                )}
                <div className={`flex items-center gap-2 ${!isGestor ? 'ml-auto' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setEditingTarefa(null)}
                    className="btn-ghost text-xs py-2 px-4"
                  >
                    Fechar
                  </button>
                  {canModifyTask && (
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary text-xs py-2 px-4"
                    >
                      {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Right Column: Comments / Annotations */}
            <div className="hidden md:flex md:w-[380px] p-6 bg-surface-elevated flex-col justify-between overflow-hidden">
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <h3 className="font-display text-sm font-bold text-text-primary">Anotações da Demanda</h3>
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
                      <p className="text-[10px] text-text-secondary opacity-40 mt-0.5">Escreva anotações importantes para o filmmaker.</p>
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

              {/* Comment input */}
              <form onSubmit={handleAddComentario} className="border-t border-border pt-4 mt-4 space-y-2">
                <textarea
                  required
                  rows={2}
                  value={novoComentario}
                  onChange={e => setNovoComentario(e.target.value)}
                  className="input text-xs resize-none py-2 bg-background border-border/80"
                  placeholder="Adicione uma anotação de captação..."
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

        {/* Mobile Annotations Drawer (Gaveta) */}
        {isAnnotationsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden flex items-end justify-center">
            {/* Backdrop click closes drawer */}
            <div className="absolute inset-0" onClick={() => setIsAnnotationsOpen(false)} />
            
            <div className="relative bg-surface-elevated w-full max-h-[85vh] rounded-t-2xl border-t border-border flex flex-col justify-between overflow-hidden shadow-2xl animate-fade-in p-6 z-10">
              {/* Handle bar for drawer drag suggestion */}
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-4" />
              
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <h3 className="font-display text-sm font-bold text-text-primary flex items-center gap-1.5">
                    <span>Anotações da Demanda</span>
                    {comentarios.length > 0 && (
                      <span className="bg-gold/25 text-gold text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {comentarios.length}
                      </span>
                    )}
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setIsAnnotationsOpen(false)} 
                    className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                  {comentariosLoading ? (
                    <div className="h-full flex items-center justify-center py-10">
                      <p className="text-xs text-text-secondary animate-pulse">Carregando anotações...</p>
                    </div>
                  ) : comentarios.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-xs text-text-secondary opacity-60">Sem anotações ainda.</p>
                      <p className="text-[10px] text-text-secondary opacity-40 mt-0.5">Escreva anotações importantes para o filmmaker.</p>
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

              {/* Comment input */}
              <form onSubmit={handleAddComentario} className="border-t border-border pt-4 mt-4 space-y-2">
                <textarea
                  required
                  rows={2}
                  value={novoComentario}
                  onChange={e => setNovoComentario(e.target.value)}
                  className="input text-xs resize-none py-2 bg-background border-border/80"
                  placeholder="Adicione uma anotação de captação..."
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
        )}
      </>
    )}

      {/* Create Demand Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-surface border border-border w-full max-w-lg rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border bg-surface-elevated sticky top-0">
              <h2 className="font-display text-lg font-bold text-text-primary">Agendar Nova Demanda</h2>
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
                  placeholder="Ex: Captação de vídeo de treino - Reels"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase">Descrição / Requisitos</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="input text-sm resize-none"
                  placeholder="Instruções sobre equipamentos, ideias de roteiro, etc."
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
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">Data Programada</label>
                  <input
                    type="date"
                    value={newPrazo}
                    onChange={e => setNewPrazo(e.target.value)}
                    className="input text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase">⏰ Horário de Início</label>
                  <input
                    type="time"
                    value={newHorarioInicio}
                    onChange={e => setNewHorarioInicio(e.target.value)}
                    className="input text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase">Filmmaker / Responsável</label>
                <select
                  value={newRespId}
                  onChange={e => setNewRespId(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">Atribuir depois (Fila)</option>
                  {membros.map(m => (
                    <option key={m.id} value={m.id}>{m.nome} ({m.cargo || m.role.replace(/_/g, ' ')})</option>
                  ))}
                </select>
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
                  {loading ? 'Agendando...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export to WhatsApp Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
              <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
                <Share2 className="text-gold" size={20} />
                Exportar Agenda da Semana
              </h2>
              <button onClick={() => setIsExportOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-text-secondary uppercase">Filtrar por Membro:</label>
                <select
                  value={exportMembro}
                  onChange={e => setExportMembro(e.target.value)}
                  className="input py-1 pr-8 text-xs bg-surface-elevated font-medium w-auto"
                >
                  <option value="todos">Exportar Geral (Toda a Equipe)</option>
                  {membros.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Texto para o WhatsApp (Visualização)</label>
                <textarea
                  readOnly
                  rows={12}
                  value={whatsappText}
                  className="input text-xs font-mono resize-none py-3 bg-surface-elevated border-border text-text-primary leading-relaxed cursor-default focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-[10px] text-text-secondary">
                  💡 Clique no botão de cópia abaixo e depois cole diretamente no grupo do WhatsApp da agência!
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsExportOpen(false)}
                    className="btn-ghost text-xs py-2 px-4"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleCopyWhatsAppText}
                    className="btn-primary flex items-center gap-1.5 text-xs py-2 px-4"
                  >
                    <Clipboard size={14} />
                    Copiar Agenda
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
