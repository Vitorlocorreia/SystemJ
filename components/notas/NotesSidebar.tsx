'use client'

import { useState } from 'react'
import {
  FileText,
  Star,
  Folder,
  Tag,
  Trash2,
  Plus,
  Building2,
  FolderPlus,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import type { ClientePublico, NoteFolder } from '@/types'

interface NotesSidebarProps {
  currentFilter: string
  onFilterChange: (filter: string) => void
  clientes: ClientePublico[]
  folders: NoteFolder[]
  activeFolderId: string | null
  onFolderSelect: (folderId: string | null) => void
  activeTag: string | null
  onTagSelect: (tag: string | null) => void
  allTags: string[]
  onCreateFolder: (nome: string, clienteId?: string) => void
  totalNotes: number
  fixedNotesCount: number
  trashNotesCount: number
}

export default function NotesSidebar({
  currentFilter,
  onFilterChange,
  clientes,
  folders,
  activeFolderId,
  onFolderSelect,
  activeTag,
  onTagSelect,
  allTags,
  onCreateFolder,
  totalNotes,
  fixedNotesCount,
  trashNotesCount
}: NotesSidebarProps) {
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderClienteId, setNewFolderClienteId] = useState('')

  function handleCreateFolderSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    onCreateFolder(newFolderName.trim(), newFolderClienteId || undefined)
    setNewFolderName('')
    setNewFolderClienteId('')
    setIsFolderModalOpen(false)
  }

  return (
    <div className="w-64 bg-surface border-r border-border flex flex-col h-full overflow-hidden select-none">
      {/* Header Sidebar */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gold-muted border border-gold/30 flex items-center justify-center text-gold">
            <FileText size={16} />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-text-primary leading-none">Apple Notes</h2>
            <span className="text-[9px] text-text-secondary">Engine Nativa Jota</span>
          </div>
        </div>

        <button
          onClick={() => setIsFolderModalOpen(true)}
          className="p-1.5 rounded-lg text-text-secondary hover:text-gold hover:bg-surface-elevated transition-colors"
          title="Nova Pasta"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      {/* Categories & Folders Tree */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6 text-xs">
        {/* Quick Views */}
        <div className="space-y-1">
          <button
            onClick={() => {
              onFilterChange('todas')
              onFolderSelect(null)
              onTagSelect(null)
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium ${
              currentFilter === 'todas' && !activeFolderId && !activeTag
                ? 'bg-gold-muted text-gold border border-gold/30 font-bold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText size={14} className="text-gold" />
              <span>Todas as Notas</span>
            </div>
            <span className="text-[10px] font-mono font-bold">{totalNotes}</span>
          </button>

          <button
            onClick={() => {
              onFilterChange('fixadas')
              onFolderSelect(null)
              onTagSelect(null)
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium ${
              currentFilter === 'fixadas'
                ? 'bg-gold-muted text-gold border border-gold/30 font-bold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star size={14} className="text-amber-400 fill-amber-400/20" />
              <span>⭐ Fixadas</span>
            </div>
            <span className="text-[10px] font-mono font-bold">{fixedNotesCount}</span>
          </button>

          <button
            onClick={() => {
              onFilterChange('lixeira')
              onFolderSelect(null)
              onTagSelect(null)
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium ${
              currentFilter === 'lixeira'
                ? 'bg-danger/10 text-danger border border-danger/30 font-bold'
                : 'text-text-secondary hover:text-danger hover:bg-danger/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trash2 size={14} />
              <span>Lixeira (30d)</span>
            </div>
            <span className="text-[10px] font-mono font-bold">{trashNotesCount}</span>
          </button>
        </div>

        {/* Client Folders */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-text-secondary uppercase tracking-wider px-2">
            <span>📁 Pastas por Cliente</span>
            <Building2 size={12} className="text-gold" />
          </div>

          <div className="space-y-1">
            {clientes.map(c => {
              const isSelected = currentFilter === `cliente_${c.id}`
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    onFilterChange(`cliente_${c.id}`)
                    onFolderSelect(null)
                    onTagSelect(null)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-all text-left ${
                    isSelected
                      ? 'bg-gold-muted text-gold border border-gold/30 font-bold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <span className="truncate">{c.nome}</span>
                  <ChevronRight size={12} className="opacity-40 shrink-0" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Custom Folders */}
        {folders.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold text-text-secondary uppercase tracking-wider px-2">
              <span>Minhas Pastas</span>
              <Folder size={12} />
            </div>

            <div className="space-y-1">
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    onFolderSelect(f.id)
                    onFilterChange('folder')
                    onTagSelect(null)
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all text-left ${
                    activeFolderId === f.id
                      ? 'bg-gold-muted text-gold border border-gold/30 font-bold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <Folder size={13} className="text-gold" />
                  <span className="truncate">{f.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags List */}
        {allTags.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-[10px] font-bold text-text-secondary uppercase tracking-wider px-2">
              <span>🏷️ Tags Recentes</span>
              <Tag size={12} />
            </div>

            <div className="flex flex-wrap gap-1 px-1">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    onTagSelect(activeTag === tag ? null : tag)
                    onFilterChange('tag')
                  }}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                    activeTag === tag
                      ? 'bg-gold text-black font-bold'
                      : 'bg-surface-elevated border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Nova Pasta */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl animate-scale-in">
            <h3 className="font-display text-sm font-bold text-text-primary">Criar Nova Pasta</h3>
            <form onSubmit={handleCreateFolderSubmit} className="space-y-3">
              <div>
                <label className="label">Nome da Pasta *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pautas Especiais, Roteiros..."
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label">Vincular a um Cliente (Opcional)</label>
                <select
                  value={newFolderClienteId}
                  onChange={e => setNewFolderClienteId(e.target.value)}
                  className="input text-xs"
                >
                  <option value="">Geral (Sem cliente específico)</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsFolderModalOpen(false)} className="btn-ghost text-xs py-1.5 px-3">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-xs py-1.5 px-4">
                  Criar Pasta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
