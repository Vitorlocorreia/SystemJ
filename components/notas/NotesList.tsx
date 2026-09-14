'use client'

import { useState, useMemo } from 'react'
import {
  Search,
  Plus,
  Star,
  CheckSquare,
  Paperclip,
  Building2,
  FileText
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Note } from '@/types'

interface NotesListProps {
  notes: Note[]
  activeNoteId: string | null
  onNoteSelect: (noteId: string) => void
  onCreateNote: () => void
  onToggleFixNote: (noteId: string, e: React.MouseEvent) => void
  searchTerm: string
  onSearchChange: (term: string) => void
}

export default function NotesList({
  notes,
  activeNoteId,
  onNoteSelect,
  onCreateNote,
  onToggleFixNote,
  searchTerm,
  onSearchChange
}: NotesListProps) {
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchSearch =
        n.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.conteudo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.tags && n.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (n.cliente && n.cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()))

      return matchSearch
    })
  }, [notes, searchTerm])

  return (
    <div className="w-80 bg-surface-elevated/40 border-r border-border flex flex-col h-full overflow-hidden">
      {/* Search Bar & New Note Button */}
      <div className="p-3 border-b border-border space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xs font-bold text-text-primary uppercase tracking-wider">
            Notas ({filteredNotes.length})
          </h3>
          <button
            onClick={onCreateNote}
            className="btn-primary text-xs py-1 px-3 shadow-gold-glow flex items-center gap-1 font-bold"
          >
            <Plus size={13} />
            <span>Nova Nota</span>
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar título, conteúdo, #tags..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="input pl-9 py-1.5 text-xs bg-surface"
          />
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredNotes.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <FileText size={28} className="text-text-secondary opacity-30 mb-2" />
            <p className="text-xs font-medium text-text-secondary">Nenhuma nota encontrada.</p>
            <button onClick={onCreateNote} className="btn-secondary text-[11px] py-1 px-3 mt-3">
              + Criar Primeira Nota
            </button>
          </div>
        ) : (
          filteredNotes.map(n => {
            const isSelected = activeNoteId === n.id
            const totalChecklist = n.checklist_itens?.length || 0
            const doneChecklist = n.checklist_itens?.filter(i => i.concluido).length || 0
            const totalAnexos = n.anexos?.length || 0

            return (
              <div
                key={n.id}
                onClick={() => onNoteSelect(n.id)}
                className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer space-y-1.5 group relative ${
                  isSelected
                    ? 'border-gold bg-gold/10 shadow-gold-glow'
                    : 'border-border/60 bg-surface hover:border-gold/30 hover:bg-surface-elevated'
                }`}
              >
                {/* Title & Pin Button */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-text-primary text-xs truncate leading-snug group-hover:text-gold transition-colors">
                    {n.titulo || 'Sem título'}
                  </h4>
                  <button
                    onClick={e => onToggleFixNote(n.id, e)}
                    className={`p-0.5 rounded hover:bg-surface-elevated transition-colors shrink-0 ${
                      n.is_fixed ? 'text-amber-400' : 'text-text-secondary opacity-30 group-hover:opacity-100'
                    }`}
                    title={n.is_fixed ? 'Desafixar Nota' : 'Fixar Nota'}
                  >
                    <Star size={12} className={n.is_fixed ? 'fill-amber-400' : ''} />
                  </button>
                </div>

                {/* Content Snippet */}
                <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                  {n.conteudo ? n.conteudo.replace(/^[#\s*]+/, '') : 'Nota vazia...'}
                </p>

                {/* Meta Badges & Info */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[9px] text-text-secondary">
                  <span>{formatDate(n.updated_at || n.created_at)}</span>

                  <div className="flex items-center gap-2">
                    {totalChecklist > 0 && (
                      <span className="flex items-center gap-1 font-mono text-gold font-bold">
                        <CheckSquare size={10} />
                        {doneChecklist}/{totalChecklist}
                      </span>
                    )}

                    {totalAnexos > 0 && (
                      <span className="flex items-center gap-1 font-mono text-cyan-400">
                        <Paperclip size={10} />
                        {totalAnexos}
                      </span>
                    )}

                    {n.cliente && (
                      <span className="badge-gold text-[8px] font-bold px-1.5 py-0">
                        {n.cliente.nome}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
