'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { X, Plus, Tag, Trash2, Edit2, Check } from 'lucide-react'
import type { CategoriaFinanceiro } from '@/types'

interface CategoriasModalProps {
  isOpen: boolean
  onClose: () => void
  categorias: CategoriaFinanceiro[]
  onCategoriasChange: (categorias: CategoriaFinanceiro[]) => void
}

const CORES_PALETA = [
  '#C9A84C', // Dourado Jota
  '#10B981', // Verde Esmeralda
  '#EF4444', // Vermelho Coral
  '#3B82F6', // Azul Royal
  '#8B5CF6', // Roxo Violeta
  '#EC4899', // Rosa Pink
  '#F59E0B', // Âmbar / Laranja
  '#06B6D4', // Ciano Tech
  '#64748B', // Cinza Ardósia
]

export default function CategoriasModal({
  isOpen,
  onClose,
  categorias,
  onCategoriasChange
}: CategoriasModalProps) {
  const [loading, setLoading] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<'receita' | 'despesa'>('receita')
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState('#C9A84C')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [editandoCor, setEditandoCor] = useState('')

  if (!isOpen) return null

  const categoriasFiltradas = categorias.filter(c => c.tipo === abaAtiva)

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) {
      toast.error('Informe o nome da categoria.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('categorias_financeiro')
        .insert({
          nome: novoNome.trim(),
          tipo: abaAtiva,
          cor: novaCor,
        })
        .select('*')
        .single()

      if (error) throw error

      toast.success('Categoria adicionada com sucesso!')
      onCategoriasChange([...categorias, data])
      setNovoNome('')
    } catch (err: any) {
      console.error('Erro ao adicionar categoria:', err)
      toast.error(err.message || 'Erro ao criar categoria.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) {
      toast.error('O nome não pode ficar vazio.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('categorias_financeiro')
        .update({
          nome: editandoNome.trim(),
          cor: editandoCor,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (error) throw error

      toast.success('Categoria atualizada!')
      onCategoriasChange(categorias.map(c => c.id === id ? data : c))
      setEditandoId(null)
    } catch (err: any) {
      console.error('Erro ao editar categoria:', err)
      toast.error(err.message || 'Erro ao atualizar categoria.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Deseja realmente excluir a categoria "${nome}"? Lançamentos vinculados poderão ficar sem categoria.`)) {
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('categorias_financeiro')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Categoria removida!')
      onCategoriasChange(categorias.filter(c => c.id !== id))
    } catch (err: any) {
      console.error('Erro ao excluir categoria:', err)
      toast.error(err.message || 'Erro ao excluir categoria.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-gold" />
            <h2 className="font-display text-lg font-bold text-text-primary">Categorias Financeiras</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border bg-surface-elevated/50 px-6 pt-3">
          <button
            type="button"
            onClick={() => { setAbaAtiva('receita'); setNovaCor('#C9A84C') }}
            className={`pb-3 px-4 text-xs font-bold transition-all relative ${
              abaAtiva === 'receita'
                ? 'text-success border-b-2 border-success'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Receitas ({categorias.filter(c => c.tipo === 'receita').length})
          </button>
          <button
            type="button"
            onClick={() => { setAbaAtiva('despesa'); setNovaCor('#EF4444') }}
            className={`pb-3 px-4 text-xs font-bold transition-all relative ${
              abaAtiva === 'despesa'
                ? 'text-danger border-b-2 border-danger'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Despesas ({categorias.filter(c => c.tipo === 'despesa').length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Adicionar Nova Categoria Form */}
          <form onSubmit={handleAdicionar} className="p-4 bg-surface-elevated rounded-xl border border-border space-y-3">
            <p className="text-xs font-bold text-text-primary uppercase tracking-wider">
              + Nova Categoria de {abaAtiva === 'receita' ? 'Receita' : 'Despesa'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Ex: Patrocínios, Câmeras, Cloud..."
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                className="input text-xs flex-1"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary text-xs py-2 px-3 flex items-center gap-1 shrink-0"
              >
                <Plus size={14} />
                <span>Adicionar</span>
              </button>
            </div>

            {/* Paleta de Cores */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-semibold text-text-secondary">Cor:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CORES_PALETA.map(cor => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setNovaCor(cor)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      novaCor === cor ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-surface' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* Listagem de Categorias */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Categorias Cadastradas</p>
            {categoriasFiltradas.length === 0 ? (
              <p className="text-xs text-text-secondary italic py-4 text-center">Nenhuma categoria cadastrada para este tipo.</p>
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl bg-surface-elevated overflow-hidden">
                {categoriasFiltradas.map(c => {
                  const isEdit = editandoId === c.id

                  return (
                    <div key={c.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      {isEdit ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editandoNome}
                            onChange={e => setEditandoNome(e.target.value)}
                            className="input text-xs py-1 flex-1"
                          />
                          <div className="flex items-center gap-1">
                            {CORES_PALETA.slice(0, 5).map(cor => (
                              <button
                                key={cor}
                                type="button"
                                onClick={() => setEditandoCor(cor)}
                                className={`w-4 h-4 rounded-full ${editandoCor === cor ? 'ring-2 ring-white' : 'opacity-70'}`}
                                style={{ backgroundColor: cor }}
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => handleSalvarEdicao(c.id)}
                            className="p-1.5 bg-success/20 text-success rounded-lg hover:bg-success/30"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: c.cor || '#C9A84C' }}
                            />
                            <span className="font-medium text-text-primary truncate">{c.nome}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditandoId(c.id)
                                setEditandoNome(c.nome)
                                setEditandoCor(c.cor || '#C9A84C')
                              }}
                              className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleExcluir(c.id, c.nome)}
                              className="p-1.5 text-text-secondary hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-elevated/50 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs py-2 px-5">
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
