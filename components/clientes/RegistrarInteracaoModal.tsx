'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks/useProfile'
import { toast } from 'sonner'
import { MessageSquare, X, Plus } from 'lucide-react'

interface RegistrarInteracaoModalProps {
  clienteId: string
  clienteNome: string
}

export default function RegistrarInteracaoModal({ clienteId, clienteNome }: RegistrarInteracaoModalProps) {
  const router = useRouter()
  const { profile } = useProfile()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [descricao, setDescricao] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) {
      toast.error('Erro: Usuário não identificado')
      return
    }
    if (!descricao.trim()) {
      toast.error('A descrição da interação não pode ser vazia')
      return
    }
    setLoading(true)

    const supabase = createClient() as any
    const { error } = await supabase.from('interacoes').insert({
      cliente_id: clienteId,
      descricao: descricao.trim(),
      autor_id: profile.id,
    })

    if (error) {
      toast.error('Erro ao registrar interação: ' + error.message)
    } else {
      toast.success('Interação registrada com sucesso!')
      setDescricao('')
      setIsOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-xs flex items-center gap-1.5 hover:border-gold/30"
      >
        <MessageSquare size={13} className="text-gold" />
        Registrar Interação
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 gap-4 animate-scale-in">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-gold-muted text-gold flex items-center justify-center shrink-0">
                <MessageSquare size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-bold text-text-primary">
                  Registrar Interação
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Cliente: <span className="text-text-primary font-medium">{clienteNome}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-text-secondary hover:text-text-primary shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="descricao" className="label">
                  Anotações / Descrição da Interação *
                </label>
                <textarea
                  id="descricao"
                  required
                  rows={5}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="input resize-none py-3 text-sm focus:ring-gold/20 focus:border-gold"
                  placeholder="Descreva o que foi conversado, alinhado ou decidido com o cliente..."
                />
              </div>

              <div className="flex gap-3 justify-end border-t border-border/40 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs py-2 px-4"
                >
                  {loading ? 'Salvando...' : 'Salvar interação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
