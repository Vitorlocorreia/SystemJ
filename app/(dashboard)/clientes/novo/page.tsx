'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useProfile } from '@/lib/hooks/useProfile'

export default function NovoClientePage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    cnpj_cpf: '',
    email: '',
    telefone: '',
    segmento: '',
    status: 'prospecto' as const,
    valor_contrato: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    let value = e.target.value.replace(/\D/g, '') // remove non-digits
    if (value.length > 11) value = value.slice(0, 11)
    
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
    } else if (value.length > 6) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3')
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,4})$/, '($1) $2')
    } else if (value.length > 0) {
      value = value.replace(/^(\d*)$/, '($1')
    }
    
    setForm(prev => ({ ...prev, telefone: value }))
  }

  function handleCnpjCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 14) value = value.slice(0, 14)

    if (value.length > 11) {
      // CNPJ: 00.000.000/0000-00
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    } else if (value.length > 9) {
      // CPF: 000.000.000-00
      value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    } else if (value.length > 6) {
      value = value.replace(/^(\d{3})(\d{3})(\d{0,3})$/, '$1.$2.$3')
    } else if (value.length > 3) {
      value = value.replace(/^(\d{3})(\d{0,3})$/, '$1.$2')
    }
    
    setForm(prev => ({ ...prev, cnpj_cpf: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('clientes').insert({
      nome: form.nome,
      cnpj_cpf: form.cnpj_cpf || null,
      email: form.email || null,
      telefone: form.telefone || null,
      segmento: form.segmento || null,
      status: form.status,
      valor_contrato: form.valor_contrato ? parseFloat(form.valor_contrato.replace(',', '.')) : null,
      criado_por: profile.id,
    })

    if (error) {
      toast.error('Erro ao criar cliente: ' + error.message)
    } else {
      toast.success('Cliente criado com sucesso!')
      router.push('/clientes')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/clientes" className="btn-ghost p-2 -ml-2">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-display-md text-text-primary">Novo Cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="nome" className="label">Nome *</label>
            <input
              id="nome"
              name="nome"
              required
              value={form.nome}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="Nome da empresa ou pessoa"
            />
          </div>

          <div>
            <label htmlFor="cnpj_cpf" className="label">CNPJ / CPF</label>
            <input
              id="cnpj_cpf"
              name="cnpj_cpf"
              value={form.cnpj_cpf}
              onChange={handleCnpjCpfChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="00.000.000/0000-00 ou 000.000.000-00"
            />
          </div>

          <div>
            <label htmlFor="segmento" className="label">Segmento esportivo</label>
            <input
              id="segmento"
              name="segmento"
              value={form.segmento}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="Ex: Futebol, Basquete..."
            />
          </div>

          <div>
            <label htmlFor="email" className="label">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="contato@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="telefone" className="label">Telefone</label>
            <input
              id="telefone"
              name="telefone"
              value={form.telefone}
              onChange={handlePhoneChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="(11) 90000-0000"
            />
          </div>

          <div>
            <label htmlFor="status" className="label">Status</label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
            >
              <option value="prospecto">Prospecto</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <div>
            <label htmlFor="valor_contrato" className="label">Valor do Contrato Mensal (R$)</label>
            <input
              id="valor_contrato"
              name="valor_contrato"
              value={form.valor_contrato}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="0,00"
            />
            <p className="text-[10px] text-text-secondary mt-1">Use vírgula ou ponto para centavos.</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border/60">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Salvando...' : 'Criar cliente'}
          </button>
          <Link href="/clientes" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
