'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Users, X, Check } from 'lucide-react'
import type { Profile } from '@/types'

interface Props {
  projetoId: string
  membros: Profile[]
  colaboradoresIniciais: string[]
  isGestor: boolean
}

export default function CollaboratorManager({ projetoId, membros, colaboradoresIniciais, isGestor }: Props) {
  const [colabs, setColabs] = useState<string[]>(colaboradoresIniciais)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Find active collaborator details
  const activeMembers = membros.filter(m => colabs.includes(m.id))

  async function handleToggleColab(profileId: string) {
    setLoading(true)
    const supabase = createClient()

    const isCurrentlyColab = colabs.includes(profileId)

    if (isCurrentlyColab) {
      // Remove collaborator
      const { error } = await supabase
        .from('projeto_colaboradores')
        .delete()
        .eq('projeto_id', projetoId)
        .eq('profile_id', profileId)

      if (error) {
        toast.error('Erro ao remover colaborador: ' + error.message)
      } else {
        setColabs(prev => prev.filter(id => id !== profileId))
        toast.success('Membro removido da mesa')
      }
    } else {
      // Add collaborator
      const { error } = await supabase
        .from('projeto_colaboradores')
        .insert({
          projeto_id: projetoId,
          profile_id: profileId,
        })

      if (error) {
        toast.error('Erro ao adicionar colaborador: ' + error.message)
      } else {
        setColabs(prev => [...prev, profileId])
        toast.success('Membro adicionado à mesa')
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* List of avatars */}
      <div className="flex -space-x-2 overflow-hidden">
        {activeMembers.map(m => (
          <div
            key={m.id}
            title={`${m.nome} (${m.cargo || m.role.replace(/_/g, ' ')})`}
            className="inline-block h-7 w-7 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-[10px] font-bold text-gold ring-2 ring-background cursor-help"
          >
            {m.nome.substring(0, 2).toUpperCase()}
          </div>
        ))}
        {activeMembers.length === 0 && (
          <p className="text-xs text-text-secondary">Nenhum colaborador atribuído (apenas gestores e o responsável veem esta mesa)</p>
        )}
      </div>

      {/* Button to manage */}
      {isGestor && (
        <button
          onClick={() => setIsOpen(true)}
          className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-full"
        >
          <Users size={12} />
          Acesso à Mesa
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-xl overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-elevated">
              <h3 className="font-display text-sm font-bold text-text-primary">Quem pode ver esta Mesa?</h3>
              <button onClick={() => setIsOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
              <p className="text-xs text-text-secondary mb-3">
                Selecione os membros da equipe que terão acesso a visualizar e gerenciar demandas dentro desta mesa. Gestores têm acesso automático a todas as mesas.
              </p>

              {membros
                .filter(m => m.role !== 'gestor_equipe' && m.role !== 'gestor_financeiro') // Gestores não precisam ser atribuídos
                .map(m => {
                  const isChecked = colabs.includes(m.id)

                  return (
                    <button
                      key={m.id}
                      disabled={loading}
                      onClick={() => handleToggleColab(m.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-surface-elevated hover:bg-surface-elevated/70 border border-border transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">{m.nome}</p>
                        <p className="text-[10px] text-text-secondary capitalize">{m.cargo || m.role.replace(/_/g, ' ')}</p>
                      </div>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                        isChecked ? 'bg-gold border-gold text-black' : 'border-border bg-background'
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                    </button>
                  )
                })}
            </div>

            <div className="flex justify-end p-4 border-t border-border bg-surface-elevated">
              <button
                onClick={() => setIsOpen(false)}
                className="btn-primary text-xs py-1.5 px-4"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
