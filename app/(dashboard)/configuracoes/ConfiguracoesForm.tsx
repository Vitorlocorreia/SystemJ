'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, User, CreditCard, Camera, Loader2 } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Profile, CategoriaFinanceiro } from '@/types'

interface ConfiguracoesFormProps {
  profile: Profile
  categorias: CategoriaFinanceiro[]
  isGestor: boolean
}

export default function ConfiguracoesForm({ profile, categorias, isGestor }: ConfiguracoesFormProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'perfil' | 'categorias'>(isGestor ? 'categorias' : 'perfil')
  const [profileForm, setProfileForm] = useState({
    nome: profile.nome || '',
    cargo: profile.cargo || '',
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Categories form state
  const [newCat, setNewCat] = useState<{ nome: string; tipo: 'receita' | 'despesa'; cor: string }>({
    nome: '',
    tipo: 'receita',
    cor: '#C9A84C',
  })
  const [catLoading, setCatLoading] = useState(false)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem (JPG, PNG, WebP)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB')
      return
    }

    setAvatarUploading(true)
    const supabase = createClient() as any

    // Upload to storage
    const ext = file.name.split('.').pop()
    const fileName = `${profile.id}.${ext}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true, cacheControl: '3600' })

    if (uploadError) {
      toast.error('Erro ao fazer upload da foto: ' + uploadError.message)
      setAvatarUploading(false)
      return
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    if (updateError) {
      toast.error('Erro ao salvar URL da foto: ' + updateError.message)
    } else {
      setAvatarUrl(publicUrl)
      toast.success('Foto de perfil atualizada!')
      router.refresh()
    }

    setAvatarUploading(false)
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleRemoveAvatar() {
    if (!avatarUrl) return
    if (!confirm('Deseja remover sua foto de perfil?')) return

    setAvatarUploading(true)
    const supabase = createClient() as any

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', profile.id)

    if (error) {
      toast.error('Erro ao remover foto: ' + error.message)
    } else {
      setAvatarUrl(null)
      toast.success('Foto removida!')
      router.refresh()
    }
    setAvatarUploading(false)
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profileForm.nome.trim()) {
      toast.error('O nome é obrigatório')
      return
    }
    setProfileLoading(true)

    const supabase = createClient() as any
    const { error } = await supabase
      .from('profiles')
      .update({
        nome: profileForm.nome.trim(),
        cargo: profileForm.cargo.trim() || null,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Erro ao atualizar perfil: ' + error.message)
    } else {
      toast.success('Perfil atualizado com sucesso!')
      router.refresh()
    }
    setProfileLoading(false)
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCat.nome.trim()) {
      toast.error('O nome da categoria é obrigatório')
      return
    }
    setCatLoading(true)

    const supabase = createClient() as any
    const { error } = await supabase.from('categorias_financeiro').insert({
      nome: newCat.nome.trim(),
      tipo: newCat.tipo,
      cor: newCat.cor,
    })

    if (error) {
      toast.error('Erro ao adicionar categoria: ' + error.message)
    } else {
      toast.success('Categoria adicionada com sucesso!')
      setNewCat({ nome: '', tipo: 'receita', cor: '#C9A84C' })
      router.refresh()
    }
    setCatLoading(false)
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Deseja realmente remover esta categoria?')) return

    const supabase = createClient() as any
    const { error } = await supabase
      .from('categorias_financeiro')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Erro ao remover categoria. Certifique-se de que não existem lançamentos vinculados a ela.')
    } else {
      toast.success('Categoria removida com sucesso!')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="font-display text-display-md text-text-primary">Configurações</h1>
        <p className="text-text-secondary text-sm mt-1">Gerencie seu perfil e as regras do sistema</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-px">
        {isGestor && (
          <button
            onClick={() => setActiveTab('categorias')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 flex items-center gap-2 ${
              activeTab === 'categorias'
                ? 'border-gold text-text-primary font-semibold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <CreditCard size={16} />
            Categorias Financeiras
          </button>
        )}
        <button
          onClick={() => setActiveTab('perfil')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 flex items-center gap-2 ${
            activeTab === 'perfil'
              ? 'border-gold text-text-primary font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <User size={16} />
          Meu Perfil
        </button>
      </div>

      {activeTab === 'perfil' && (
        <div className="max-w-xl space-y-5">
          {/* Avatar Section */}
          <div className="card space-y-4">
            <h2 className="label text-text-primary text-base">Foto de Perfil</h2>
            <div className="flex items-center gap-5">
              {/* Avatar display */}
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-border bg-gold-muted flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-gold font-bold text-2xl">
                      {getInitials(profile.nome)}
                    </span>
                  )}
                </div>
                {/* Overlay on hover */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                >
                  {avatarUploading ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <Camera size={20} className="text-white" />
                  )}
                </button>
              </div>

              {/* Upload actions */}
              <div className="space-y-2 flex-1">
                <p className="text-xs text-text-secondary leading-relaxed">
                  JPG, PNG ou WebP até 5MB. A foto aparecerá na barra lateral e nas demandas.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    {avatarUploading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Camera size={12} />
                    )}
                    {avatarUrl ? 'Trocar Foto' : 'Carregar Foto'}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={avatarUploading}
                      className="text-xs text-danger/70 hover:text-danger transition-colors py-1.5"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Profile form */}
          <form onSubmit={handleProfileSubmit} className="card space-y-5">
            <h2 className="label text-text-primary text-base">Informações Pessoais</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="nome" className="label">Nome *</label>
                <input
                  id="nome"
                  required
                  value={profileForm.nome}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="cargo" className="label">Cargo</label>
                <input
                  id="cargo"
                  value={profileForm.cargo}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, cargo: e.target.value }))}
                  placeholder="Ex: Filmmaker Sênior, Designer"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Nível de Acesso (Cargo Real)</label>
                <input
                  disabled
                  value={profile.role.replace(/_/g, ' ').toUpperCase()}
                  className="input bg-surface-elevated text-text-secondary border-dashed cursor-not-allowed"
                />
                <p className="text-[10px] text-text-secondary mt-1">
                  Nível de acesso gerenciado pelos administradores de equipe.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <button type="submit" disabled={profileLoading} className="btn-primary">
                {profileLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'categorias' && isGestor && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <h2 className="label mb-4 text-text-primary text-base">Categorias Cadastradas</h2>
              
              <div className="divide-y divide-border">
                {categorias.length === 0 && (
                  <p className="text-text-secondary text-sm py-4">Nenhuma categoria cadastrada.</p>
                )}
                {categorias.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.cor }}
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{cat.nome}</p>
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider">{cat.tipo}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-text-secondary hover:text-danger p-1.5 rounded hover:bg-danger/10 transition-colors"
                      title="Excluir categoria"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Add Form */}
          <div className="lg:col-span-1">
            <form onSubmit={handleAddCategory} className="card space-y-4">
              <h2 className="label text-text-primary text-base">Nova Categoria</h2>

              <div>
                <label htmlFor="cat-nome" className="label">Nome da Categoria *</label>
                <input
                  id="cat-nome"
                  required
                  value={newCat.nome}
                  onChange={(e) => setNewCat(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Alimentação, Viagens"
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="cat-tipo" className="label">Tipo *</label>
                <select
                  id="cat-tipo"
                  value={newCat.tipo}
                  onChange={(e) => setNewCat(prev => ({ ...prev, tipo: e.target.value as 'receita' | 'despesa' }))}
                  className="input"
                >
                  <option value="receita">Receita (+)</option>
                  <option value="despesa">Despesa (-)</option>
                </select>
              </div>

              <div>
                <label htmlFor="cat-cor" className="label">Cor de Exibição *</label>
                <select
                  id="cat-cor"
                  value={newCat.cor}
                  onChange={(e) => setNewCat(prev => ({ ...prev, cor: e.target.value }))}
                  className="input"
                >
                  <option value="#C9A84C">Dourado (Jota)</option>
                  <option value="#EF4444">Vermelho (Despesas)</option>
                  <option value="#22C55E">Verde (Receitas)</option>
                  <option value="#3B82F6">Azul</option>
                  <option value="#8B5CF6">Roxo</option>
                  <option value="#F59E0B">Laranja</option>
                  <option value="#EC4899">Rosa</option>
                  <option value="#888888">Cinza</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={catLoading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              >
                <Plus size={14} />
                {catLoading ? 'Adicionando...' : 'Adicionar Categoria'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
