'use client'

import { useState, DragEvent, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, X, Trash2, Calendar, User, Flag, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Profile, ClientePublico } from '@/types'

type StatusKanban = 'planejamento' | 'em_andamento' | 'revisao' | 'concluido' | 'pausado'
type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'

interface ProjetoKanban {
  id: string
  titulo: string
  descricao: string | null
  cliente_id: string | null
  responsavel_id: string | null
  status: StatusKanban
  prioridade: Prioridade
  prazo: string | null
  notas: string | null
  ordem: number
  created_at: string
  cliente?: ClientePublico | null
  responsavel?: Profile | null
}

interface Props {
  projetosIniciais: ProjetoKanban[]
  membros: Profile[]
  clientes: ClientePublico[]
  currentUserId: string
}

const COLUNAS: { id: StatusKanban; label: string; color: string; dot: string; headerBorder: string }[] = [
  { id: 'planejamento', label: 'Planejamento', color: 'text-blue-400',       dot: 'bg-blue-500',    headerBorder: 'border-blue-500/30'    },
  { id: 'em_andamento', label: 'Em Andamento', color: 'text-yellow-400',     dot: 'bg-yellow-500',  headerBorder: 'border-yellow-500/30'  },
  { id: 'revisao',      label: 'Revisao',      color: 'text-orange-400',     dot: 'bg-orange-500',  headerBorder: 'border-orange-500/30'  },
  { id: 'concluido',    label: 'Concluido',    color: 'text-emerald-400',    dot: 'bg-emerald-500', headerBorder: 'border-emerald-500/30' },
  { id: 'pausado',      label: 'Pausado',      color: 'text-neutral-500',    dot: 'bg-neutral-500', headerBorder: 'border-border'         },
]

const PRIORIDADE_CONFIG: Record<Prioridade, { label: string; cls: string; bar: string }> = {
  baixa:   { label: 'Baixa',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30',     bar: 'bg-blue-500/50'    },
  media:   { label: 'Media',   cls: 'bg-surface text-text-secondary border-border',          bar: 'bg-gold/40'        },
  alta:    { label: 'Alta',    cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30', bar: 'bg-orange-500'     },
  urgente: { label: 'Urgente', cls: 'bg-red-500/10 text-red-400 border-red-500/30',          bar: 'bg-red-500'        },
}

export default function ProjetosKanban({ projetosIniciais, membros, clientes, currentUserId }: Props) {
  const [projetos, setProjetos] = useState<ProjetoKanban[]>(projetosIniciais)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [activeColumn, setActiveColumn] = useState<StatusKanban | null>(null)
  const [selectedProjeto, setSelectedProjeto] = useState<ProjetoKanban | null>(null)
  const [quickAddCol, setQuickAddCol] = useState<StatusKanban | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickAddLoading, setQuickAddLoading] = useState(false)
  const [loading, setLoading] = useState(false)

  const clearIndicators = () =>
    document.querySelectorAll('[data-indicator]').forEach(el => ((el as HTMLElement).style.opacity = '0'))

  const getIndicators = (col: StatusKanban) =>
    Array.from(document.querySelectorAll(`[data-indicator][data-col="${col}"]`)) as HTMLElement[]

  const getNearestIndicator = (e: DragEvent, indicators: HTMLElement[]) =>
    indicators.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect()
        const offset = e.clientY - (box.top + 50)
        if (offset < 0 && offset > closest.offset) return { offset, element: child }
        return closest
      },
      { offset: Number.NEGATIVE_INFINITY, element: indicators[indicators.length - 1] }
    )

  const handleDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.setData('projetoId', id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(id)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setActiveColumn(null)
    clearIndicators()
  }

  const handleDragOver = (e: DragEvent, col: StatusKanban) => {
    e.preventDefault()
    setActiveColumn(col)
    clearIndicators()
    const indicators = getIndicators(col)
    if (indicators.length) getNearestIndicator(e, indicators).element.style.opacity = '1'
  }

  const handleDrop = useCallback(async (e: DragEvent, col: StatusKanban) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('projetoId')
    setDraggingId(null)
    setActiveColumn(null)
    clearIndicators()

    const projeto = projetos.find(p => p.id === id)
    if (!projeto || projeto.status === col) return

    setProjetos(prev => prev.map(p => (p.id === id ? { ...p, status: col } : p)))

    const supabase = createClient()
    const { error } = await supabase.from('projetos_kanban').update({ status: col }).eq('id', id)
    if (error) {
      toast.error('Erro ao mover projeto')
      setProjetos(projetosIniciais)
    } else {
      toast.success('Projeto movido!')
    }
  }, [projetos, projetosIniciais])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProjeto) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('projetos_kanban')
      .update({
        titulo: selectedProjeto.titulo,
        descricao: selectedProjeto.descricao || null,
        cliente_id: selectedProjeto.cliente_id || null,
        responsavel_id: selectedProjeto.responsavel_id || null,
        status: selectedProjeto.status,
        prioridade: selectedProjeto.prioridade,
        prazo: selectedProjeto.prazo || null,
        notas: selectedProjeto.notas || null,
      })
      .eq('id', selectedProjeto.id)

    setLoading(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    const respObj = membros.find(m => m.id === selectedProjeto.responsavel_id) || null
    const cliObj = clientes.find(c => c.id === selectedProjeto.cliente_id) || null
    setProjetos(prev => prev.map(p => p.id === selectedProjeto.id ? { ...selectedProjeto, responsavel: respObj, cliente: cliObj } : p))
    setSelectedProjeto(null)
    toast.success('Salvo!')
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir projeto permanentemente?')) return
    const supabase = createClient()
    const { error } = await supabase.from('projetos_kanban').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    setProjetos(prev => prev.filter(p => p.id !== id))
    setSelectedProjeto(null)
    toast.success('Projeto excluido!')
  }

  async function handleQuickAdd(col: StatusKanban) {
    if (!quickAddTitle.trim()) { setQuickAddCol(null); setQuickAddTitle(''); return }
    setQuickAddLoading(true)
    const supabase = createClient()
    const meProfile = membros.find(m => m.user_id === currentUserId)
    const { data, error } = await supabase
      .from('projetos_kanban')
      .insert({
        titulo: quickAddTitle.trim(),
        status: col,
        prioridade: 'media',
        ordem: 0,
        criado_por: meProfile?.id || null,
      })
      .select('*, cliente:clientes(id,nome,email,telefone,segmento,status,created_at), responsavel:profiles!responsavel_id(id,user_id,nome,cargo,role,avatar_url,created_at)')
      .single()
    setQuickAddLoading(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    setProjetos(prev => [...prev, data])
    setQuickAddTitle('')
    setQuickAddCol(null)
    toast.success('Projeto criado!')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
          <h1 className="font-display text-display-md text-text-primary">Projetos</h1>
          <p className="text-sm text-text-secondary mt-1">Campanhas, contratos e projetos de longa duracao. Apenas gestores.</p>
        </div>

      {/* Stats bar */}
      <div className="flex gap-3 flex-wrap">
        {COLUNAS.map(col => {
          const count = projetos.filter(p => p.status === col.id).length
          return (
            <div key={col.id} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
              <span className="text-xs text-text-secondary">{col.label}</span>
              <span className={`text-xs font-bold ${col.color}`}>{count}</span>
            </div>
          )
        })}
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-6">
        {COLUNAS.map(col => {
          const colProjetos = projetos.filter(p => p.status === col.id).sort((a, b) => a.ordem - b.ordem)
          const isOver = activeColumn === col.id

          return (
            <div
              key={col.id}
              className="flex flex-col w-72 shrink-0"
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => { setActiveColumn(null); clearIndicators() }}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2.5 mb-3 rounded-xl border bg-surface ${col.headerBorder}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className={`text-xs font-bold uppercase tracking-widest ${col.color}`}>{col.label}</span>
                </div>
                <span className="text-[10px] font-bold text-text-secondary bg-surface-elevated px-2 py-0.5 rounded-full">
                  {colProjetos.length}
                </span>
              </div>

              {/* Drop zone */}
              <div className={`flex flex-col gap-2 min-h-[120px] rounded-xl p-2 transition-all duration-150 ${
                isOver ? 'bg-gold/5 ring-1 ring-gold/20' : ''
              }`}>
                {colProjetos.map(p => (
                  <ProjectCard
                    key={p.id}
                    projeto={p}
                    colId={col.id}
                    isDragging={draggingId === p.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedProjeto(p)}
                  />
                ))}

                {/* Bottom drop indicator */}
                <div data-indicator data-col={col.id} data-before="-1"
                  className="h-0.5 rounded-full bg-gold opacity-0 transition-opacity duration-100 mx-1" />

                {/* Quick Add inline form or button */}
                {quickAddCol === col.id ? (
                  <div className="rounded-xl border border-gold/30 bg-surface overflow-hidden">
                    <textarea
                      autoFocus
                      rows={2}
                      value={quickAddTitle}
                      onChange={e => setQuickAddTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(col.id) }
                        if (e.key === 'Escape') { setQuickAddCol(null); setQuickAddTitle('') }
                      }}
                      placeholder="Nome do projeto... (Enter para criar)"
                      className="w-full bg-transparent text-sm text-text-primary placeholder-text-secondary/40 p-3 resize-none focus:outline-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between px-3 pb-2.5 gap-2">
                      <p className="text-[9px] text-text-secondary/40">Enter para criar · Esc para cancelar</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setQuickAddCol(null); setQuickAddTitle('') }}
                          className="text-[10px] text-text-secondary hover:text-text-primary px-2 py-1 rounded transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleQuickAdd(col.id)}
                          disabled={quickAddLoading || !quickAddTitle.trim()}
                          className="btn-primary text-[10px] py-1 px-3 disabled:opacity-40"
                        >
                          {quickAddLoading ? '...' : 'Criar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setQuickAddCol(col.id); setQuickAddTitle('') }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-text-secondary/40 hover:text-text-secondary hover:bg-surface-elevated/60 transition-all duration-150 group mt-1"
                  >
                    <span className="w-5 h-5 rounded-md border border-dashed border-border group-hover:border-gold/40 flex items-center justify-center transition-colors">
                      <Plus size={10} />
                    </span>
                    <span className="text-[10px] font-medium">Adicionar projeto</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail Modal */}
      {selectedProjeto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-scale-in">
            <form onSubmit={handleUpdate} className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border mb-2 ${PRIORIDADE_CONFIG[selectedProjeto.prioridade].cls}`}>
                    <Flag size={8} /> {PRIORIDADE_CONFIG[selectedProjeto.prioridade].label}
                  </span>
                  <p className="text-[10px] text-gold font-bold uppercase tracking-wider truncate">
                    {selectedProjeto.cliente?.nome || 'Sem cliente'}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedProjeto(null)} className="text-text-secondary hover:text-text-primary shrink-0 mt-1">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Titulo</label>
                <input required value={selectedProjeto.titulo}
                  onChange={e => setSelectedProjeto({ ...selectedProjeto, titulo: e.target.value })}
                  className="input text-sm font-semibold" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Descricao</label>
                <textarea rows={2} value={selectedProjeto.descricao || ''}
                  onChange={e => setSelectedProjeto({ ...selectedProjeto, descricao: e.target.value })}
                  className="input text-sm resize-none" placeholder="Contexto do projeto..." />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Cliente Relacionado</label>
                <select value={selectedProjeto.cliente_id || ''}
                  onChange={e => setSelectedProjeto({ ...selectedProjeto, cliente_id: e.target.value || null })}
                  className="input text-sm">
                  <option value="">Sem cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Status</label>
                  <select value={selectedProjeto.status}
                    onChange={e => setSelectedProjeto({ ...selectedProjeto, status: e.target.value as StatusKanban })}
                    className="input text-sm">
                    {COLUNAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Prioridade</label>
                  <select value={selectedProjeto.prioridade}
                    onChange={e => setSelectedProjeto({ ...selectedProjeto, prioridade: e.target.value as Prioridade })}
                    className="input text-sm">
                    {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Prazo</label>
                  <input type="date" value={selectedProjeto.prazo || ''}
                    onChange={e => setSelectedProjeto({ ...selectedProjeto, prazo: e.target.value || null })}
                    className="input text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Responsavel</label>
                  <select value={selectedProjeto.responsavel_id || ''}
                    onChange={e => setSelectedProjeto({ ...selectedProjeto, responsavel_id: e.target.value || null })}
                    className="input text-sm">
                    <option value="">Sem atribuicao</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                <button type="button" onClick={() => handleDelete(selectedProjeto.id)}
                  className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3">
                  <Trash2 size={13} /> Excluir
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedProjeto(null)} className="btn-ghost text-xs py-2 px-4">Fechar</button>
                  <button type="submit" disabled={loading} className="btn-primary text-xs py-2 px-4">
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>

            {/* Notes panel */}
            <div className="w-full md:w-80 bg-surface-elevated border-t md:border-t-0 md:border-l border-border flex flex-col p-5 gap-3">
              <div>
                <h3 className="font-display text-sm font-bold text-text-primary">Bloco de Notas</h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Referencias, decisoes, brainstorm.</p>
              </div>
              <textarea
                rows={14}
                value={selectedProjeto.notas || ''}
                onChange={e => setSelectedProjeto({ ...selectedProjeto, notas: e.target.value })}
                className="input text-xs resize-none leading-relaxed font-mono bg-background border-border/60 flex-1"
                placeholder={"- Links de referencia\n- Decisoes tomadas\n- Observacoes do cliente\n- Proximos passos..."}
              />
              <p className="text-[10px] text-text-secondary opacity-40">Salvo junto ao formulario.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function ProjectCard({ projeto, colId, isDragging, onDragStart, onDragEnd, onClick }: {
  projeto: ProjetoKanban
  colId: StatusKanban
  isDragging: boolean
  onDragStart: (e: DragEvent, id: string) => void
  onDragEnd: () => void
  onClick: () => void
}) {
  const pCfg = PRIORIDADE_CONFIG[projeto.prioridade]
  return (
    <>
      <div data-indicator data-col={colId} data-before={projeto.id}
        className="h-0.5 rounded-full bg-gold opacity-0 transition-opacity duration-100" />
      <div
        draggable
        onDragStart={e => onDragStart(e, projeto.id)}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={`group relative rounded-xl border bg-surface-elevated select-none cursor-grab active:cursor-grabbing transition-all duration-150 ${
          isDragging ? 'opacity-30 scale-95 rotate-1' : 'hover:border-gold/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30'
        } border-border/60 overflow-hidden`}
      >
        <div className={`h-0.5 w-full ${pCfg.bar}`} />
        <div className="p-3.5 space-y-2">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[9px] font-bold text-gold/80 uppercase tracking-wider truncate flex-1">
              {projeto.cliente?.nome || 'Sem cliente'}
            </span>
            <span className={`shrink-0 text-[9px] font-bold border px-1.5 py-0.5 rounded-full leading-none ${pCfg.cls}`}>
              {pCfg.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">{projeto.titulo}</p>
          {projeto.descricao && (
            <p className="text-[10px] text-text-secondary/70 line-clamp-2 leading-relaxed">{projeto.descricao}</p>
          )}
          <div className="flex items-center justify-between text-[10px] text-text-secondary pt-1.5 border-t border-border/40">
            <div className="flex items-center gap-1 min-w-0">
              {projeto.responsavel ? (
                <>
                  <User size={9} className="shrink-0" />
                  <span className="truncate max-w-[80px]">{projeto.responsavel.nome.split(' ')[0]}</span>
                </>
              ) : <span className="opacity-30">Sem resp.</span>}
            </div>
            {projeto.prazo && (
              <div className="flex items-center gap-1 shrink-0">
                <Calendar size={9} />
                <span>{formatDate(projeto.prazo)}</span>
              </div>
            )}
          </div>
          {projeto.notas && (
            <p className="text-[10px] text-text-secondary/50 line-clamp-1 italic border-t border-border/30 pt-2">
              {projeto.notas.slice(0, 60)}...
            </p>
          )}
        </div>
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity">
          <ChevronRight size={11} className="text-text-secondary" />
        </div>
      </div>
    </>
  )
}
