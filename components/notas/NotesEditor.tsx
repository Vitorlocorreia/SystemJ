'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Star,
  Trash2,
  Paperclip,
  CheckSquare,
  Link2,
  Building2,
  Check,
  Plus,
  ExternalLink,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Underline,
  List,
  Tag,
  Copy,
  Sparkles,
  RefreshCw
} from 'lucide-react'
import type { Note, ClientePublico, Projeto, ChecklistItem, NoteAttachment } from '@/types'
import { toast } from 'sonner'

interface NotesEditorProps {
  note: Note | null
  clientes: ClientePublico[]
  projetos: Projeto[]
  onUpdateNote: (updated: Partial<Note>) => void
  onDeleteNote: (noteId: string) => void
  onToggleFix: (noteId: string) => void
}

export default function NotesEditor({
  note,
  clientes,
  projetos,
  onUpdateNote,
  onDeleteNote,
  onToggleFix
}: NotesEditorProps) {
  const [titulo, setTitulo] = useState(note?.titulo || '')
  const [conteudo, setConteudo] = useState(note?.conteudo || '')
  const [clienteId, setClienteId] = useState<string>(note?.cliente_id || '')
  const [projetoId, setProjetoId] = useState<string>(note?.projeto_id || '')
  const [tags, setTags] = useState<string[]>(note?.tags || [])
  const [newTagInput, setNewTagInput] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note?.checklist_itens || [])
  const [newChecklistText, setNewChecklistText] = useState('')
  const [anexos, setAnexos] = useState<NoteAttachment[]>(note?.anexos || [])
  const [newAttachmentTitle, setNewAttachmentTitle] = useState('')
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('')
  const [newAttachmentType, setNewAttachmentType] = useState<'imagem' | 'pdf' | 'documento' | 'audio' | 'video' | 'outros'>('imagem')

  const [savingStatus, setSavingStatus] = useState<'salvo' | 'salvando'>('salvo')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Sync internal state when active note changes
  useEffect(() => {
    if (note) {
      setTitulo(note.titulo || '')
      setConteudo(note.conteudo || '')
      setClienteId(note.cliente_id || '')
      setProjetoId(note.projeto_id || '')
      setTags(note.tags || [])
      setChecklist(note.checklist_itens || [])
      setAnexos(note.anexos || [])
    }
  }, [note?.id])

  // Debounced Autosave Trigger
  const triggerAutosave = useCallback(
    (changes: Partial<Note>) => {
      setSavingStatus('salvando')
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

      debounceTimerRef.current = setTimeout(() => {
        onUpdateNote(changes)
        setSavingStatus('salvo')
      }, 700)
    },
    [onUpdateNote]
  )

  if (!note) {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-text-secondary opacity-40 mb-3">
          <Sparkles size={32} />
        </div>
        <h3 className="font-display text-base font-bold text-text-primary">Apple Notes Engine</h3>
        <p className="text-xs text-text-secondary mt-1 max-w-sm">
          Selecione uma nota na lista ao lado ou crie uma nova nota para iniciar o editor.
        </p>
      </div>
    )
  }

  // Formatting Helpers
  function applyFormatting(prefix: string, suffix = '') {
    const textarea = document.getElementById('apple-notes-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = conteudo.substring(start, end)
    const replacement = `${prefix}${selected || 'texto'}${suffix}`

    const newContent = conteudo.substring(0, start) + replacement + conteudo.substring(end)
    setConteudo(newContent)
    triggerAutosave({ conteudo: newContent })
  }

  // Checklist Handlers
  function handleToggleChecklist(id: string) {
    const updated = checklist.map(i => (i.id === id ? { ...i, concluido: !i.concluido } : i))
    setChecklist(updated)
    triggerAutosave({ checklist_itens: updated })
  }

  function handleAddChecklist(e: React.FormEvent) {
    e.preventDefault()
    if (!newChecklistText.trim()) return
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      texto: newChecklistText.trim(),
      concluido: false
    }
    const updated = [...checklist, newItem]
    setChecklist(updated)
    setNewChecklistText('')
    triggerAutosave({ checklist_itens: updated })
  }

  function handleDeleteChecklist(id: string) {
    const updated = checklist.filter(i => i.id !== id)
    setChecklist(updated)
    triggerAutosave({ checklist_itens: updated })
  }

  // Tag Handlers
  function handleAddTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault()
      const clean = newTagInput.trim().replace(/^#/, '')
      if (!tags.includes(clean)) {
        const updated = [...tags, clean]
        setTags(updated)
        setNewTagInput('')
        triggerAutosave({ tags: updated })
      }
    }
  }

  function handleDeleteTag(tagToDelete: string) {
    const updated = tags.filter(t => t !== tagToDelete)
    setTags(updated)
    triggerAutosave({ tags: updated })
  }

  // Anexo Handlers
  function handleAddAnexo(e: React.FormEvent) {
    e.preventDefault()
    if (!newAttachmentTitle.trim() || !newAttachmentUrl.trim()) return
    const newAnexo: NoteAttachment = {
      id: crypto.randomUUID(),
      nome: newAttachmentTitle.trim(),
      url: newAttachmentUrl.trim(),
      tipo: newAttachmentType
    }
    const updated = [...anexos, newAnexo]
    setAnexos(updated)
    setNewAttachmentTitle('')
    setNewAttachmentUrl('')
    triggerAutosave({ anexos: updated })
  }

  function handleDeleteAnexo(anexoId: string) {
    const updated = anexos.filter(a => a.id !== anexoId)
    setAnexos(updated)
    triggerAutosave({ anexos: updated })
  }

  // Copy Note Content
  function handleCopyNote() {
    navigator.clipboard.writeText(`${titulo}\n\n${conteudo}`)
    toast.success('Conteúdo da nota copiado!')
  }

  const doneChecklist = checklist.filter(i => i.concluido).length
  const progressPercent = checklist.length > 0 ? Math.round((doneChecklist / checklist.length) * 100) : 0

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden">
      {/* Editor Header & Control Toolbar */}
      <div className="p-4 border-b border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={titulo}
            onChange={e => {
              setTitulo(e.target.value)
              triggerAutosave({ titulo: e.target.value })
            }}
            placeholder="Título da Nota..."
            className="bg-transparent font-display text-lg font-bold text-text-primary focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Status do Autosave */}
          <span className="text-[10px] text-text-secondary/70 flex items-center gap-1 font-mono">
            {savingStatus === 'salvando' ? (
              <>
                <RefreshCw size={11} className="animate-spin text-gold" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check size={11} className="text-success" />
                <span>Salvo agora</span>
              </>
            )}
          </span>

          {/* Vínculo de Cliente */}
          <select
            value={clienteId}
            onChange={e => {
              setClienteId(e.target.value)
              triggerAutosave({ cliente_id: e.target.value || null })
            }}
            className="input py-1 text-xs max-w-[150px] bg-surface-elevated font-medium"
          >
            <option value="">Cliente: Nenhum</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          {/* Action buttons */}
          <button
            onClick={() => onToggleFix(note.id)}
            className={`p-1.5 rounded-lg border transition-all ${
              note.is_fixed
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary'
            }`}
            title={note.is_fixed ? 'Desafixar Nota' : 'Fixar Nota'}
          >
            <Star size={14} className={note.is_fixed ? 'fill-amber-400' : ''} />
          </button>

          <button
            onClick={handleCopyNote}
            className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
            title="Copiar Texto da Nota"
          >
            <Copy size={13} />
            <span className="hidden md:inline">Copiar</span>
          </button>

          <button
            onClick={() => onDeleteNote(note.id)}
            className="p-1.5 rounded-lg border border-border bg-surface-elevated text-text-secondary hover:text-danger hover:border-danger/30 transition-all"
            title="Excluir Nota"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Formatting Toolbar (Apple Context Bar) */}
      <div className="px-4 py-2 bg-surface-elevated/60 border-b border-border flex items-center gap-1 overflow-x-auto text-xs shrink-0">
        <button
          onClick={() => applyFormatting('# ')}
          className="p-1.5 rounded hover:bg-surface text-text-secondary hover:text-text-primary font-bold"
          title="Título H1"
        >
          <Heading1 size={14} />
        </button>
        <button
          onClick={() => applyFormatting('## ')}
          className="p-1.5 rounded hover:bg-surface text-text-secondary hover:text-text-primary font-bold"
          title="Título H2"
        >
          <Heading2 size={14} />
        </button>
        <button
          onClick={() => applyFormatting('### ')}
          className="p-1.5 rounded hover:bg-surface text-text-secondary hover:text-text-primary font-bold"
          title="Título H3"
        >
          <Heading3 size={14} />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          onClick={() => applyFormatting('**', '**')}
          className="p-1.5 rounded hover:bg-surface text-text-secondary hover:text-text-primary"
          title="Negrito"
        >
          <Bold size={14} />
        </button>
        <button
          onClick={() => applyFormatting('*', '*')}
          className="p-1.5 rounded hover:bg-surface text-text-secondary hover:text-text-primary"
          title="Itálico"
        >
          <Italic size={14} />
        </button>
        <button
          onClick={() => applyFormatting('<u>', '</u>')}
          className="p-1.5 rounded hover:bg-surface text-text-secondary hover:text-text-primary"
          title="Sublinhado"
        >
          <Underline size={14} />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          onClick={() => applyFormatting('- ')}
          className="p-1.5 rounded hover:bg-surface text-text-secondary hover:text-text-primary"
          title="Lista"
        >
          <List size={14} />
        </button>

        {/* Tags input bar */}
        <div className="ml-auto flex items-center gap-1.5">
          <Tag size={12} className="text-gold" />
          <div className="flex items-center gap-1">
            {tags.map(t => (
              <span key={t} className="badge-gold text-[9px] font-bold px-1.5 py-0.5 flex items-center gap-1">
                #{t}
                <button onClick={() => handleDeleteTag(t)} className="hover:text-danger">×</button>
              </span>
            ))}
            <input
              type="text"
              placeholder="+ tag [Enter]"
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="bg-transparent border-none text-[10px] text-text-primary focus:outline-none w-20 placeholder-text-secondary/50"
            />
          </div>
        </div>
      </div>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Editor Area (Mac Notes Styling) */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-5 shadow-2xl space-y-2">
          <textarea
            id="apple-notes-textarea"
            rows={14}
            value={conteudo}
            onChange={e => {
              setConteudo(e.target.value)
              triggerAutosave({ conteudo: e.target.value })
            }}
            placeholder={"Escreva sua nota, roteiro ou ata livremente...\n\nUse #tags ou clique nos botões acima para formatar."}
            className="w-full bg-transparent text-sm text-[#E0E0E0] placeholder-text-secondary/40 font-mono leading-relaxed focus:outline-none resize-none"
          />
        </div>

        {/* Checklist Widget with Progress Bar */}
        <div className="card space-y-3 border-border/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-gold" />
              <h4 className="font-display text-xs font-bold text-text-primary uppercase tracking-wider">
                Checklist da Nota
              </h4>
            </div>
            {checklist.length > 0 && (
              <span className="text-[10px] font-bold text-gold font-mono">
                {doneChecklist} de {checklist.length} concluídos ({progressPercent}%)
              </span>
            )}
          </div>

          {/* Progress bar */}
          {checklist.length > 0 && (
            <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-gold transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Input Add Checklist Item */}
          <form onSubmit={handleAddChecklist} className="flex gap-2">
            <input
              type="text"
              placeholder="Adicionar item ao checklist... (ex: Enviar orçamento)"
              value={newChecklistText}
              onChange={e => setNewChecklistText(e.target.value)}
              className="input text-xs flex-1"
            />
            <button type="submit" className="btn-primary text-xs py-1.5 px-3">+ Add</button>
          </form>

          {/* Checklist List */}
          <div className="space-y-1.5 pt-1">
            {checklist.map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border/60 hover:border-gold/20 transition-all group">
                <button onClick={() => handleToggleChecklist(item.id)} className="flex items-center gap-2.5 flex-1 text-left">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    item.concluido ? 'bg-gold border-gold text-black' : 'border-border bg-surface-elevated'
                  }`}>
                    {item.concluido && <Check size={11} strokeWidth={3} />}
                  </div>
                  <span className={`text-xs ${item.concluido ? 'line-through text-text-secondary' : 'text-text-primary font-medium'}`}>
                    {item.texto}
                  </span>
                </button>
                <button onClick={() => handleDeleteChecklist(item.id)} className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-danger p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Attachments & Files Widget */}
        <div className="card space-y-3 border-border/80">
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-cyan-400" />
            <h4 className="font-display text-xs font-bold text-text-primary uppercase tracking-wider">
              Anexos & Links de Arquivos ({anexos.length})
            </h4>
          </div>

          <form onSubmit={handleAddAnexo} className="space-y-2 bg-surface-elevated p-3 rounded-xl border border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                placeholder="Nome do arquivo / link..."
                value={newAttachmentTitle}
                onChange={e => setNewAttachmentTitle(e.target.value)}
                className="input text-xs"
              />
              <input
                type="url"
                required
                placeholder="URL (https://...)"
                value={newAttachmentUrl}
                onChange={e => setNewAttachmentUrl(e.target.value)}
                className="input text-xs"
              />
              <select
                value={newAttachmentType}
                onChange={e => setNewAttachmentType(e.target.value as any)}
                className="input text-xs"
              >
                <option value="imagem">Imagem</option>
                <option value="pdf">PDF</option>
                <option value="documento">Documento</option>
                <option value="video">Vídeo / Reel</option>
              </select>
            </div>
            <button type="submit" className="btn-secondary text-xs py-1.5 w-full">+ Anexar Arquivo</button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {anexos.map(anexo => (
              <div key={anexo.id} className="p-3 rounded-xl bg-surface border border-border/60 hover:border-cyan-500/40 transition-all space-y-1 group flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text-primary text-xs truncate">{anexo.nome}</span>
                  <button onClick={() => handleDeleteAnexo(anexo.id)} className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-danger">
                    <Trash2 size={12} />
                  </button>
                </div>
                <a
                  href={anexo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline font-mono"
                >
                  <ExternalLink size={10} />
                  <span>Abrir Anexo ↗</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
