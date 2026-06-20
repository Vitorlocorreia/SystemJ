'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks/useProfile'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface RegistrarInteracaoFormProps {
  clienteId: string
  clienteNome: string
}

export default function RegistrarInteracaoForm({ clienteId, clienteNome }: RegistrarInteracaoFormProps) {
  const router = useRouter()
  const { profile } = useProfile()
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
      router.push(`/clientes/${clienteId}`)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/clientes/${clienteId}`} className="btn-ghost p-2 -ml-2">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-display-md text-text-primary">Registrar Interação</h1>
          <p className="text-text-secondary text-sm mt-1">Cliente: {clienteNome}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label htmlFor="descricao" className="label">Anotações / Descrição da Interação *</label>
          <textarea
            id="descricao"
            required
            rows={6}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input resize-none py-3"
            placeholder="Descreva o que foi conversado, alinhado ou decidido com o cliente..."
          />
        </div>

        <div className="flex gap-3 pt-2 border-t border-border">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Salvando...' : 'Salvar interação'}
          </button>
          <Link href={`/clientes/${clienteId}`} className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
