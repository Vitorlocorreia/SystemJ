'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import type { Cliente, EmpresaGrupo } from '@/types'
import { getInitials } from '@/lib/utils'
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
    empresa: ((cliente as any).empresa as EmpresaGrupo) || 'jota_esportivo',
    forma_pagamento: (cliente as any).forma_pagamento || 'PIX',
    valor_contrato: cliente.valor_contrato ? String(cliente.valor_contrato) : '',
    dia_vencimento: (cliente as any).dia_vencimento ? String((cliente as any).dia_vencimento) : '10',
    data_inicio_contrato: (cliente as any).data_inicio_contrato || '',
    data_fim_contrato: (cliente as any).data_fim_contrato || '',
  })

  const [contratoIndeterminado, setContratoIndeterminado] = useState<boolean>(
    !(cliente as any).data_fim_contrato
  )

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
    if (!form.nome.trim()) {
      toast.error('Informe o nome do cliente.')
      return
    }

    setLoading(true)

    // Formatação correta de valor decimal
    let cleanValor: number | null = null
    if (form.valor_contrato && form.valor_contrato.trim() !== '') {
      const parsed = parseFloat(form.valor_contrato.replace(/\./g, '').replace(',', '.'))
      if (!isNaN(parsed)) cleanValor = parsed
    }

    // Dia de vencimento
    let cleanDiaVenc: number = 10
    if (form.dia_vencimento) {
      const parsedDia = parseInt(form.dia_vencimento, 10)
      if (!isNaN(parsedDia) && parsedDia >= 1 && parsedDia <= 31) {
        cleanDiaVenc = parsedDia
      }
    }

    const supabase = createClient() as any
    const { error } = await supabase
      .from('clientes')
      .update({
        nome: form.nome.trim(),
        cnpj_cpf: form.cnpj_cpf.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        segmento: form.segmento.trim() || null,
        status: form.status,
        empresa: form.empresa || 'jota_esportivo',
        forma_pagamento: form.forma_pagamento || 'PIX',
        valor_contrato: cleanValor,
        dia_vencimento: cleanDiaVenc,
        data_inicio_contrato: form.data_inicio_contrato || null,
        data_fim_contrato: contratoIndeterminado ? null : (form.data_fim_contrato || null),
      })
      .eq('id', cliente.id)

    if (error) {
      toast.error('Erro ao atualizar cliente: ' + error.message)
      setLoading(false)
    } else {
      toast.success('Cliente atualizado com sucesso!')
      router.push(`/clientes/${cliente.id}`)
      router.refresh()
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/clientes/${cliente.id}`} className="btn-ghost p-2 -ml-2">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Editar Cliente</h1>
          <p className="text-xs text-text-secondary">Atualizar dados cadastrais de {cliente.nome}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Header Visual do Cliente */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-elevated border border-border">
          <div className="w-14 h-14 rounded-2xl bg-gold-muted border border-gold/30 flex items-center justify-center shrink-0">
            <span className="font-display text-gold font-bold text-xl">
              {getInitials(form.nome || cliente.nome)}
            </span>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-text-primary">{form.nome || 'Nome do Cliente'}</h3>
            <p className="text-xs text-text-secondary">{form.segmento || 'Segmento não informado'} • Grupo Jota</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nome" className="label">Nome da Empresa / Marca *</label>
            <input
              id="nome"
              name="nome"
              required
              value={form.nome}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
            />
          </div>

          <div>
            <label htmlFor="segmento" className="label">Segmento / Ramo</label>
            <input
              id="segmento"
              name="segmento"
              value={form.segmento}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="Ex: Fitness, Odontologia, Futebol..."
            />
          </div>

          {/* Empresa do Grupo Jota */}
          <div>
            <label htmlFor="empresa" className="label">Empresa do Grupo Jota</label>
            <select
              id="empresa"
              name="empresa"
              value={form.empresa}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
            >
              <option value="jota_esportivo">⚽ Jota Esportivo</option>
              <option value="jota_tech">💻 Jota Tech</option>
              <option value="holding">🏛️ Holding (Grupo Jota)</option>
            </select>
          </div>

          <div>
            <label htmlFor="status" className="label">Status do Cliente</label>
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
            <label htmlFor="cnpj_cpf" className="label">CNPJ / CPF</label>
            <input
              id="cnpj_cpf"
              name="cnpj_cpf"
              value={form.cnpj_cpf}
              onChange={handleCnpjCpfChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div>
            <label htmlFor="email" className="label">E-mail de Contato</label>
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
            <label htmlFor="telefone" className="label">Telefone / WhatsApp</label>
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
            <label htmlFor="forma_pagamento" className="label">Forma de Pagamento</label>
            <select
              id="forma_pagamento"
              name="forma_pagamento"
              value={form.forma_pagamento}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
            >
              <option value="PIX">PIX</option>
              <option value="Boleto">Boleto Bancário</option>
              <option value="Transferência">Transferência Bancária (TED/DOC)</option>
              <option value="Cartão">Cartão de Crédito</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="valor_contrato" className="label">Valor do Contrato Mensal (R$)</label>
            <input
              id="valor_contrato"
              name="valor_contrato"
              value={form.valor_contrato}
              onChange={handleChange}
              className="input focus:ring-gold/20 focus:border-gold"
              placeholder="0,00"
            />
            <p className="text-[10px] text-text-secondary mt-1">Ex: 1500,00 ou 1.500,00</p>
          </div>

          {/* Dados de Contrato e Vencimento */}
          <div className="sm:col-span-2 pt-3 border-t border-border/40 space-y-3">
            <h4 className="font-display text-xs font-bold text-gold uppercase tracking-wider">
              🗓️ Vencimento & Vigência do Contrato
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="dia_vencimento" className="label">Dia de Vencimento Mensal</label>
                <input
                  id="dia_vencimento"
                  name="dia_vencimento"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dia_vencimento}
                  onChange={handleChange}
                  className="input focus:ring-gold/20 focus:border-gold text-xs"
                  placeholder="Ex: 5, 10, 15, 20"
                />
                <p className="text-[10px] text-text-secondary mt-1">Dia do mês (1 a 31) em que a fatura vence.</p>
              </div>

              <div>
                <label htmlFor="data_inicio_contrato" className="label">Início do Contrato</label>
                <input
                  id="data_inicio_contrato"
                  name="data_inicio_contrato"
                  type="date"
                  value={form.data_inicio_contrato}
                  onChange={handleChange}
                  className="input focus:ring-gold/20 focus:border-gold text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="data_fim_contrato" className="label mb-0">Término do Contrato</label>
                </div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="chk_indeterminado"
                    checked={contratoIndeterminado}
                    onChange={e => {
                      const checked = e.target.checked
                      setContratoIndeterminado(checked)
                      if (checked) {
                        setForm(prev => ({ ...prev, data_fim_contrato: '' }))
                      }
                    }}
                    className="rounded border-border text-gold focus:ring-gold accent-gold cursor-pointer"
                  />
                  <label htmlFor="chk_indeterminado" className="text-[11px] font-bold text-gold cursor-pointer">
                    Sem término (Contínuo)
                  </label>
                </div>

                <input
                  id="data_fim_contrato"
                  name="data_fim_contrato"
                  type="date"
                  disabled={contratoIndeterminado}
                  value={form.data_fim_contrato}
                  onChange={handleChange}
                  className={`input focus:ring-gold/20 focus:border-gold text-xs ${
                    contratoIndeterminado ? 'opacity-40 cursor-not-allowed bg-surface-elevated' : ''
                  }`}
                />
                {contratoIndeterminado && (
                  <p className="text-[10px] text-gold mt-1 font-mono font-bold">♾️ Contrato por tempo indeterminado</p>
                )}
              </div>
            </div>
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
