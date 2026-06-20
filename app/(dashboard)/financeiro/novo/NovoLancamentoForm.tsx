'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks/useProfile'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { CategoriaFinanceiro, ClientePublico, Projeto } from '@/types'

interface NovoLancamentoFormProps {
  categorias: CategoriaFinanceiro[]
  clientes: ClientePublico[]
  projetos: Projeto[]
}

export default function NovoLancamentoForm({ categorias, clientes, projetos }: NovoLancamentoFormProps) {
  const router = useRouter()
  const { profile } = useProfile()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    tipo: 'receita' as const,
    descricao: '',
    valor: '',
    categoria_id: '',
    cliente_id: '',
    projeto_id: '',
    data_lancamento: new Date().toISOString().split('T')[0],
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      // Reset category if changing type to ensure valid type-category mapping
      if (name === 'tipo') {
        next.categoria_id = ''
      }
      return next
    })
  }

  // Filter categories by selected transaction type
  const filteredCategorias = categorias.filter(cat => cat.tipo === form.tipo)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) {
      toast.error('Erro: Usuário não identificado')
      return
    }
    if (!form.descricao.trim()) {
      toast.error('A descrição é obrigatória')
      return
    }
    if (!form.valor || parseFloat(form.valor.replace(',', '.')) <= 0) {
      toast.error('Informe um valor maior que zero')
      return
    }
    setLoading(true)

    const parsedValor = parseFloat(form.valor.replace(',', '.'))
    const supabase = createClient() as any
    const { error } = await supabase.from('lancamentos').insert({
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor: parsedValor,
      categoria_id: form.categoria_id || null,
      cliente_id: form.cliente_id || null,
      projeto_id: form.projeto_id || null,
      data_lancamento: form.data_lancamento,
      criado_por: profile.id,
    })

    if (error) {
      toast.error('Erro ao registrar lançamento: ' + error.message)
    } else {
      toast.success('Lançamento registrado com sucesso!')
      router.push('/financeiro')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="btn-ghost p-2 -ml-2">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-display-md text-text-primary">Novo Lançamento</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tipo" className="label">Tipo de Lançamento *</label>
            <select
              id="tipo"
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              className="input"
            >
              <option value="receita">Receita (+)</option>
              <option value="despesa">Despesa (-)</option>
            </select>
          </div>

          <div>
            <label htmlFor="valor" className="label">Valor (R$) *</label>
            <input
              id="valor"
              name="valor"
              required
              value={form.valor}
              onChange={handleChange}
              className="input font-display font-semibold"
              placeholder="0,00"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="descricao" className="label">Descrição *</label>
            <input
              id="descricao"
              name="descricao"
              required
              value={form.descricao}
              onChange={handleChange}
              className="input"
              placeholder="Ex: Patrocínio mensal Adidas / Licença Software"
            />
          </div>

          <div>
            <label htmlFor="categoria_id" className="label">Categoria *</label>
            <select
              id="categoria_id"
              name="categoria_id"
              required
              value={form.categoria_id}
              onChange={handleChange}
              className="input"
            >
              <option value="">Selecione uma categoria...</option>
              {filteredCategorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="data_lancamento" className="label">Data de Lançamento *</label>
            <input
              id="data_lancamento"
              name="data_lancamento"
              type="date"
              required
              value={form.data_lancamento}
              onChange={handleChange}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="cliente_id" className="label">Cliente (Opcional)</label>
            <select
              id="cliente_id"
              name="cliente_id"
              value={form.cliente_id}
              onChange={handleChange}
              className="input"
            >
              <option value="">Nenhum cliente vinculado</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="projeto_id" className="label">Projeto (Opcional)</label>
            <select
              id="projeto_id"
              name="projeto_id"
              value={form.projeto_id}
              onChange={handleChange}
              className="input"
            >
              <option value="">Nenhum projeto vinculado</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-border">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Salvando...' : 'Confirmar lançamento'}
          </button>
          <Link href="/financeiro" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
