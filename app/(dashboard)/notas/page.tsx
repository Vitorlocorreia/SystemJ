'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import NotesSidebar from '@/components/notas/NotesSidebar'
import NotesList from '@/components/notas/NotesList'
import NotesEditor from '@/components/notas/NotesEditor'
import type { Note, NoteFolder, ClientePublico, Projeto } from '@/types'

export default function NotasPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)

  // Supabase Data
  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<NoteFolder[]>([])
  const [clientes, setClientes] = useState<ClientePublico[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])

  // Filtering & Selection state
  const [currentFilter, setCurrentFilter] = useState<string>('todas')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)

  // Load Initial Data
  useEffect(() => {
    setMounted(true)
    const loadData = async () => {
      const supabase = createClient() as any

      try {
        const [
          { data: fetchClientes },
          { data: fetchProjetos },
          { data: fetchFolders },
          { data: fetchNotes }
        ] = await Promise.all([
          supabase.from('clientes').select('id, nome, status').order('nome'),
          supabase.from('projetos').select('id, nome, cliente_id').order('nome'),
          supabase.from('note_folders').select('*').order('created_at', { ascending: false }),
          supabase.from('notes').select('*, cliente:clientes(id, nome)').order('updated_at', { ascending: false })
        ])

        if (fetchClientes) setClientes(fetchClientes)
        if (fetchProjetos) setProjetos(fetchProjetos)
        if (fetchFolders) setFolders(fetchFolders)
        if (fetchNotes) {
          setNotes(fetchNotes)
          if (fetchNotes.length > 0) setActiveNoteId(fetchNotes[0].id)
        }
      } catch (err) {
        console.error('Notes fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // All Tags extracted from notes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach(n => {
      if (n.tags && Array.isArray(n.tags)) {
        n.tags.forEach(t => tagSet.add(t))
      }
    })
    return Array.from(tagSet)
  }, [notes])

  // Filtered Notes according to Sidebar selection
  const visibleNotes = useMemo(() => {
    return notes.filter(n => {
      // 1. Trash filter
      if (currentFilter === 'lixeira') return n.in_trash
      if (n.in_trash) return false

      // 2. Fixed filter
      if (currentFilter === 'fixadas') return n.is_fixed

      // 3. Client filter
      if (currentFilter.startsWith('cliente_')) {
        const targetClienteId = currentFilter.replace('cliente_', '')
        return n.cliente_id === targetClienteId
      }

      // 4. Folder filter
      if (currentFilter === 'folder' && activeFolderId) {
        return n.folder_id === activeFolderId
      }

      // 5. Tag filter
      if (activeTag) {
        return n.tags && n.tags.includes(activeTag)
      }

      return true
    })
  }, [notes, currentFilter, activeFolderId, activeTag])

  // Active Note object
  const activeNote = useMemo(() => {
    return notes.find(n => n.id === activeNoteId) || visibleNotes[0] || null
  }, [notes, activeNoteId, visibleNotes])

  // Create New Note
  const handleCreateNote = async () => {
    const supabase = createClient() as any
    const newNoteId = crypto.randomUUID()
    const newNoteObj: Note = {
      id: newNoteId,
      titulo: 'Nova Nota',
      conteudo: '',
      is_fixed: false,
      is_favorite: false,
      in_trash: false,
      tags: [],
      checklist_itens: [],
      anexos: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cliente_id: currentFilter.startsWith('cliente_') ? currentFilter.replace('cliente_', '') : null,
      folder_id: activeFolderId || null
    }

    setNotes(prev => [newNoteObj, ...prev])
    setActiveNoteId(newNoteId)

    // Try saving in Supabase with fallback
    try {
      const { error } = await supabase.from('notes').insert({
        id: newNoteId,
        titulo: 'Nova Nota',
        conteudo: '',
        is_fixed: false,
        is_favorite: false,
        in_trash: false,
        tags: [],
        checklist_itens: [],
        anexos: [],
        cliente_id: newNoteObj.cliente_id,
        folder_id: newNoteObj.folder_id
      })
      if (error) console.warn('Supabase notes table insert fallback:', error.message)
    } catch (e) {
      console.warn('Notes fallback active')
    }

    toast.success('Nova nota criada!')
  }

  // Update Note
  const handleUpdateNote = async (updatedFields: Partial<Note>) => {
    if (!activeNoteId) return

    setNotes(prev =>
      prev.map(n => {
        if (n.id !== activeNoteId) return n
        return {
          ...n,
          ...updatedFields,
          updated_at: new Date().toISOString()
        }
      })
    )

    const supabase = createClient() as any
    try {
      await supabase
        .from('notes')
        .update({
          ...updatedFields,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeNoteId)
    } catch (e) {
      console.warn('Note update fallback active')
    }
  }

  // Toggle Fix Note
  const handleToggleFixNote = async (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const target = notes.find(n => n.id === noteId)
    if (!target) return

    const newFixed = !target.is_fixed
    setNotes(prev =>
      prev.map(n => (n.id === noteId ? { ...n, is_fixed: newFixed } : n))
    )

    const supabase = createClient() as any
    try {
      await supabase.from('notes').update({ is_fixed: newFixed }).eq('id', noteId)
    } catch (e) {}

    toast.success(newFixed ? 'Nota fixada no topo!' : 'Nota desafixada!')
  }

  // Delete Note (Move to Trash)
  const handleDeleteNote = async (noteId: string) => {
    const target = notes.find(n => n.id === noteId)
    if (!target) return

    if (target.in_trash) {
      // Delete permanently
      setNotes(prev => prev.filter(n => n.id !== noteId))
      const supabase = createClient() as any
      try { await supabase.from('notes').delete().eq('id', noteId) } catch (e) {}
      toast.success('Nota excluída permanentemente!')
    } else {
      // Move to trash
      setNotes(prev =>
        prev.map(n => (n.id === noteId ? { ...n, in_trash: true } : n))
      )
      const supabase = createClient() as any
      try { await supabase.from('notes').update({ in_trash: true }).eq('id', noteId) } catch (e) {}
      toast.success('Nota movida para a Lixeira!')
    }
  }

  // Create Folder
  const handleCreateFolder = async (nome: string, clienteId?: string) => {
    const supabase = createClient() as any
    const newFolderId = crypto.randomUUID()
    const newFolderObj: NoteFolder = {
      id: newFolderId,
      nome,
      cliente_id: clienteId || null,
      created_at: new Date().toISOString()
    }

    setFolders(prev => [newFolderObj, ...prev])
    setActiveFolderId(newFolderId)
    setCurrentFilter('folder')

    try {
      await supabase.from('note_folders').insert(newFolderObj)
    } catch (e) {}

    toast.success('Pasta criada com sucesso!')
  }

  if (!mounted || loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <p className="text-text-secondary animate-pulse text-sm">Carregando Apple Notes Engine...</p>
      </div>
    )
  }

  return (
    <div className="h-[88vh] bg-background border border-border rounded-2xl overflow-hidden flex shadow-2xl animate-fade-in">
      {/* Coluna 1: Sidebar de Pastas & Tags */}
      <NotesSidebar
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        clientes={clientes}
        folders={folders}
        activeFolderId={activeFolderId}
        onFolderSelect={setActiveFolderId}
        activeTag={activeTag}
        onTagSelect={setActiveTag}
        allTags={allTags}
        onCreateFolder={handleCreateFolder}
        totalNotes={notes.filter(n => !n.in_trash).length}
        fixedNotesCount={notes.filter(n => n.is_fixed && !n.in_trash).length}
        trashNotesCount={notes.filter(n => n.in_trash).length}
      />

      {/* Coluna 2: Lista de Notas & Busca */}
      <NotesList
        notes={visibleNotes}
        activeNoteId={activeNote?.id || null}
        onNoteSelect={setActiveNoteId}
        onCreateNote={handleCreateNote}
        onToggleFixNote={handleToggleFixNote}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {/* Coluna 3: Editor Rico Apple Notes */}
      <NotesEditor
        note={activeNote}
        clientes={clientes}
        projetos={projetos}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={handleDeleteNote}
        onToggleFix={() => activeNote && handleToggleFixNote(activeNote.id)}
      />
    </div>
  )
}
