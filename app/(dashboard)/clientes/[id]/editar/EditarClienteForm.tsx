'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import type { Cliente } from '@/types'
import ExcluirClienteButton from '@/components/clientes/ExcluirClienteButton'

interface EditarClienteFormProps {
  cliente: Cliente
  isGestor: boolean
}

export default function EditarClienteForm({ cliente, isGestor }: EditarClienteFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome: cliente.nome || '',
    cnpj_cpf: cliente.cnpj_cpf || '',
    email: cliente.email || '',
    telefone: cliente.telefone || '',
    segmento: cliente.segmento || '',
    status: cliente.status || 'prospecto',
    valor_contrato: cliente.valor_contrato ? String(cliente.valor_contrato) : '',
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
    setLoading(true)

    const supabase = createClient() as any
    const { error } = await supabase
      .from('clientes')
      .update({
        nome: form.nome,
        cnpj_cpf: form.cnpj_cpf || null,
        email: form.email || null,
        telefone: form.telefone || null,
        segmento: form.segmento || null,
        status: form.status,
        valor_contrato: form.valor_contrato ? parseFloat(form.valor_contrato.replace(',', '.')) : null,
      })
      .eq('id', cliente.id)

    if (error) {
      toast.error('Erro ao atualizar cliente: ' + error.message)
    } else {
      toast.success('Cliente atualizado com sucesso!')
      router.push(`/clientes/${cliente.id}`)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/clientes/${cliente.id}`} className="btn-ghost p-2 -ml-2">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-display-md text-text-primary">Editar Cliente</h1>
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
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
          <Link href={`/clientes/${cliente.id}`} className="btn-secondary">Cancelar</Link>
        </div>
      </form>

      {/* Danger Zone */}
      {isGestor && (
        <div className="card border-danger/20 bg-danger/[0.02] space-y-4">
          <div className="flex items-center gap-2 text-danger">
            <ShieldAlert size={18} />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">
              Zona de Perigo
            </h3>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border/40">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-primary">Excluir este cliente</p>
              <p className="text-xs text-text-secondary">
                O cliente será excluído e todos os seus projetos/lançamentos serão desvinculados.
              </p>
            </div>
            <ExcluirClienteButton
              clienteId={cliente.id}
              clienteNome={cliente.nome}
              isGestor={isGestor}
              className="btn-danger text-xs py-2 px-4"
            />
          </div>
        </div>
      )}
    </div>
  )
}
