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
  Sparkles
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

type TabMesa = 'pipeline' | 'notes' | 'checklist' | 'referencias' | 'historico'

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
  const [activeTab, setActiveTab] = useState<TabMesa>('pipeline')
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

  // Nova Tarefa no Pipeline do Cliente
  const [isNovaPautaOpen, setIsNovaPautaOpen] = useState(false)
  const [novaPautaTitulo, setNovaPautaTitulo] = useState('')
  const [novaPautaDesc, setNovaPautaDesc] = useState('')
  const [novaPautaPrazo, setNovaPautaPrazo] = useState('')
  const [novaPautaRespId, setNovaPautaRespId] = useState('')
  const [creatingPauta, setCreatingPauta] = useState(false)

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
    toast.success('Item adicionado ao checklist do cliente!')
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

  // Criar Nova Pauta / Vídeo para este cliente
  async function handleCriarPauta(e: React.FormEvent) {
    e.preventDefault()
    if (!novaPautaTitulo.trim()) return

    setCreatingPauta(true)
    const supabase = createClient() as any

    // Buscar ou criar projeto do cliente
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
        status: 'a_fazer',
        responsavel_id: novaPautaRespId || currentUserId,
        responsavel_ids: novaPautaRespId ? [novaPautaRespId] : [currentUserId],
        prazo: novaPautaPrazo || null
      })
      .select('*, responsavel:profiles(*)')
      .single()

    setCreatingPauta(false)

    if (error) {
      toast.error('Erro ao criar pauta: ' + error.message)
    } else {
      setTarefas(prev => [data, ...prev])
      setNovaPautaTitulo('')
      setNovaPautaDesc('')
      setNovaPautaPrazo('')
      setIsNovaPautaOpen(false)
      toast.success('Vídeo/Pauta adicionada à mesa do cliente!')
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

          {/* Logo / Profile Avatar of Client */}
          <div className="w-16 h-16 rounded-2xl bg-gold-muted border-2 border-gold/40 flex items-center justify-center shrink-0 overflow-hidden shadow-gold-glow text-gold font-bold font-display text-2xl">
            {logoUrl ? (
              <img src={logoUrl} alt={cliente.nome} className="w-full h-full object-cover" />
            ) : (
              getInitials(cliente.nome)
            )}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary">{cliente.nome}</h1>
              <span className="badge-gold text-xs uppercase tracking-wider font-bold">
                {cliente.status}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Mesa de Conteúdo & Produção Audiovisual • {cliente.segmento || 'Sem segmento'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isGestor && (
            <ExcluirClienteButton clienteId={cliente.id} clienteNome={cliente.nome} isGestor={isGestor} />
          )}
          <Link href={`/clientes/${cliente.id}/editar`} className="btn-secondary flex items-center gap-2 text-xs py-2">
            <Edit size={14} />
            <span>Editar Perfil</span>
          </Link>
          <button onClick={() => setIsNovaPautaOpen(true)} className="btn-primary flex items-center gap-2 text-xs py-2">
            <Plus size={15} />
            <span>+ Nova Pauta / Vídeo</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation of the Mesa */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'pipeline' ? 'border-gold text-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Film size={15} />
          <span>Esteira de Vídeos ({tarefas.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'notes' ? 'border-gold text-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText size={15} />
          <span>Apple Notes do Cliente</span>
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

      {/* TAB 1: PIPELINE / ESTEIRA DE VÍDEOS */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-text-primary">
              Demandas e Vídeos Programados do Cliente
            </h3>
            <button onClick={() => setIsNovaPautaOpen(true)} className="btn-primary text-xs py-1.5 px-3">
              + Adicionar Pauta
            </button>
          </div>

          {tarefas.length === 0 ? (
            <div className="card text-center py-12 space-y-3">
              <Film size={32} className="mx-auto text-text-secondary opacity-40" />
              <p className="text-sm font-medium text-text-primary">Nenhuma pauta ou vídeo agendado para este cliente.</p>
              <button onClick={() => setIsNovaPautaOpen(true)} className="btn-primary text-xs py-2 px-4 mx-auto">
                + Criar Primeira Pauta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tarefas.map(t => (
                <div key={t.id} className="card bg-surface-elevated/40 border-border hover:border-gold/30 transition-all space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="badge-secondary text-[9px] uppercase font-bold tracking-wider">
                      {t.status.replace(/_/g, ' ')}
                    </span>
                    {t.prazo && (
                      <span className="text-[10px] text-gold font-mono flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(t.prazo)}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-text-primary leading-snug">{t.titulo}</h4>
                    {t.descricao && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{t.descricao}</p>}
                  </div>

                  {t.responsavel && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-xs text-text-secondary">
                      <User size={12} className="text-gold" />
                      <span>{t.responsavel.nome}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPLE NOTES DO CLIENTE */}
      {activeTab === 'notes' && (
        <div className="card space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-text-primary flex items-center gap-2">
                <FileText size={16} className="text-gold" /> Bloco de Notas da Mesa (Conceito Apple Notes)
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Espaço livre para pautas, roteiros, orientações de gravação e diretrizes da marca do cliente
              </p>
            </div>
            <button onClick={handleSalvarNotas} disabled={savingNotas} className="btn-primary text-xs py-1.5 px-4">
              {savingNotas ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>

          <textarea
            rows={16}
            value={notasCliente}
            onChange={e => setNotasCliente(e.target.value)}
            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-2xl p-5 text-sm text-[#E0E0E0] placeholder-text-secondary/40 font-mono leading-relaxed focus:outline-none focus:border-gold/50 resize-none"
            placeholder={"- Tom de voz e identidade visual do cliente...\n- Roteiros da semana:\n  1. Vídeo de abertura de treino\n  2. Entrevista com atleta\n- Links de inspiração..."}
          />
        </div>
      )}

      {/* TAB 3: CHECKLIST DE ENTREGÁVEIS */}
      {activeTab === 'checklist' && (
        <div className="card space-y-5 animate-fade-in">
          <div>
            <h3 className="font-display text-sm font-bold text-text-primary">Checklist de Produção & Entregáveis</h3>
            <p className="text-xs text-text-secondary mt-0.5">Lista de itens e conteúdos que devem ser gravados/entregues para este cliente</p>
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

      {/* Modal Nova Pauta / Vídeo */}
      {isNovaPautaOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-in">
            <h3 className="font-display text-lg font-bold text-text-primary">Adicionar Pauta à Mesa do Cliente</h3>
            <form onSubmit={handleCriarPauta} className="space-y-4">
              <div>
                <label className="label">Título do Vídeo / Job *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vídeo de treino em pé com CTA"
                  value={novaPautaTitulo}
                  onChange={e => setNovaPautaTitulo(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Descrição / Roteiro Rápido</label>
                <textarea
                  rows={3}
                  placeholder="Instruções de captação e estilo..."
                  value={novaPautaDesc}
                  onChange={e => setNovaPautaDesc(e.target.value)}
                  className="input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Data Prevista</label>
                  <input
                    type="date"
                    value={novaPautaPrazo}
                    onChange={e => setNovaPautaPrazo(e.target.value)}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label">Responsável</label>
                  <select
                    value={novaPautaRespId}
                    onChange={e => setNovaPautaRespId(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="">Você mesmo</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsNovaPautaOpen(false)} className="btn-ghost text-xs py-2 px-4">
                  Cancelar
                </button>
                <button type="submit" disabled={creatingPauta} className="btn-primary text-xs py-2 px-4">
                  {creatingPauta ? 'Criando...' : 'Adicionar Pauta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
