'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2, AlertTriangle, X } from 'lucide-react'

interface ExcluirClienteButtonProps {
  clienteId: string
  clienteNome: string
  isGestor: boolean
  className?: string
}

export default function ExcluirClienteButton({
  clienteId,
  clienteNome,
  isGestor,
  className = '',
}: ExcluirClienteButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!isGestor) return null

  async function handleDelete() {
    setLoading(true)
    const supabase = createClient() as any
    
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', clienteId)

    if (error) {
      toast.error('Erro ao excluir cliente: ' + error.message)
      setLoading(false)
    } else {
      toast.success('Cliente excluído com sucesso!')
      setIsOpen(false)
      router.push('/clientes')
      router.refresh()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className || "btn-secondary text-danger hover:border-danger/30 hover:bg-danger/5 flex items-center gap-2"}
      >
        <Trash2 size={14} />
        Excluir Cliente
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in animate-duration-150">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 gap-4 animate-scale-in">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-bold text-text-primary">
                  Excluir Cliente
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  Tem certeza que deseja excluir <span className="text-text-primary font-medium">{clienteNome}</span>?
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

            <div className="bg-surface-elevated/50 border border-border/60 rounded-xl p-3.5 text-xs text-text-secondary space-y-2">
              <p>Esta ação é irreversível e causará as seguintes alterações:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>O cadastro do cliente será removido permanentemente.</li>
                <li>Todos os projetos deste cliente serão mantidos, mas ficarão sem cliente vinculado.</li>
                <li>Os lançamentos financeiros deste cliente perderão o vínculo com ele.</li>
                <li>Todo o histórico de interações deste cliente será deletado de forma definitiva.</li>
              </ul>
            </div>

            <div className="flex gap-3 mt-2 justify-end border-t border-border/40 pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="btn-secondary text-xs py-2 px-4"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="btn-danger text-xs py-2 px-4 flex items-center gap-1.5"
              >
                {loading ? 'Excluindo...' : 'Sim, excluir cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
