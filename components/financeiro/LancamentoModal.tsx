'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { X, DollarSign, Calendar, Tag, User, Briefcase, Building2, Link as LinkIcon } from 'lucide-react'
import type { CategoriaFinanceiro, ClientePublico, Projeto, Lancamento, EmpresaGrupo } from '@/types'

interface LancamentoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (lancamento: Lancamento, isEdit: boolean) => void
  categorias: CategoriaFinanceiro[]
  clientes: ClientePublico[]
  projetos: Projeto[]
  currentUserId: string
  lancamentoParaEditar?: Lancamento | null
  defaultEmpresa?: EmpresaGrupo
}

export default function LancamentoModal({
  isOpen,
  onClose,
  onSuccess,
  categorias,
  clientes,
  projetos,
  currentUserId,
  lancamentoParaEditar,
  defaultEmpresa = 'jota_esportivo'
}: LancamentoModalProps) {
  const [loading, setLoading] = useState(false)
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [projetoId, setProjetoId] = useState('')
  const [empresa, setEmpresa] = useState<EmpresaGrupo>(defaultEmpresa)
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().split('T')[0])
  const [comprovanteUrl, setComprovanteUrl] = useState('')
  const [isRecorrente, setIsRecorrente] = useState(false)

  useEffect(() => {
    if (lancamentoParaEditar) {
      setTipo(lancamentoParaEditar.tipo)
      setDescricao(lancamentoParaEditar.descricao)
      setValor(lancamentoParaEditar.valor.toString())
      setCategoriaId(lancamentoParaEditar.categoria_id || '')
      setClienteId(lancamentoParaEditar.cliente_id || '')
      setProjetoId(lancamentoParaEditar.projeto_id || '')
      setEmpresa((lancamentoParaEditar.empresa as EmpresaGrupo) || defaultEmpresa)
      setDataLancamento(lancamentoParaEditar.data_lancamento)
      setComprovanteUrl(lancamentoParaEditar.comprovante_url || '')
      setIsRecorrente(Boolean(lancamentoParaEditar.is_recorrente))
    } else {
      setTipo('receita')
      setDescricao('')
      setValor('')
      setCategoriaId('')
      setClienteId('')
      setProjetoId('')
      setEmpresa(defaultEmpresa)
      setDataLancamento(new Date().toISOString().split('T')[0])
      setComprovanteUrl('')
      setIsRecorrente(false)
    }
  }, [lancamentoParaEditar, isOpen, defaultEmpresa])

  if (!isOpen) return null

  const filteredCategorias = categorias.filter(c => c.tipo === tipo)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!descricao.trim()) {
      toast.error('Informe uma descrição para o lançamento.')
      return
    }

    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Informe um valor válido maior que zero.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const payload: any = {
        tipo,
        descricao: descricao.trim(),
        valor: valorNum,
        categoria_id: categoriaId || null,
        cliente_id: clienteId || null,
        projeto_id: projetoId || null,
        empresa,
        data_lancamento: dataLancamento,
        comprovante_url: comprovanteUrl.trim() || null,
        is_recorrente: tipo === 'despesa' ? isRecorrente : false,
      }

      if (lancamentoParaEditar) {
        const { data, error } = await supabase
          .from('lancamentos')
          .update(payload)
          .eq('id', lancamentoParaEditar.id)
          .select('*, categoria:categorias_financeiro(nome, cor), cliente:clientes(id, nome), projeto:projetos(id, nome)')
          .single()

        if (error) throw error
        toast.success('Lançamento atualizado com sucesso!')
        onSuccess(data, true)
      } else {
        payload.criado_por = currentUserId

        const { data, error } = await supabase
          .from('lancamentos')
          .insert(payload)
          .select('*, categoria:categorias_financeiro(nome, cor), cliente:clientes(id, nome), projeto:projetos(id, nome)')
          .single()

        if (error) throw error
        toast.success('Lançamento registrado com sucesso!')
        onSuccess(data, false)
      }

      onClose()
    } catch (err: any) {
      console.error('Erro ao salvar lançamento:', err)
      toast.error(err.message || 'Erro ao salvar lançamento financeiro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${tipo === 'receita' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">
                {lancamentoParaEditar ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
              </h2>
              <p className="text-xs text-text-secondary">
                {lancamentoParaEditar ? 'Atualize as informações financeiras' : 'Registre uma receita ou despesa no fluxo da agência'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Toggle Tipo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface-elevated rounded-lg border border-border">
            <button
              type="button"
              onClick={() => { setTipo('receita'); setCategoriaId('') }}
              className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                tipo === 'receita'
                  ? 'bg-success text-black shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Entrada (Receita +)</span>
            </button>
            <button
              type="button"
              onClick={() => { setTipo('despesa'); setCategoriaId('') }}
              className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                tipo === 'despesa'
                  ? 'bg-danger text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Saída (Despesa −)</span>
            </button>
          </div>

          {/* Empresa do Grupo Jota */}
          <div>
            <label className="label flex items-center gap-1.5 mb-1.5">
              <Building2 size={13} className="text-gold" />
              <span>Empresa do Grupo Jota *</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEmpresa('jota_esportivo')}
                className={`py-2 px-2 text-center rounded-lg border text-xs font-medium transition-all ${
                  empresa === 'jota_esportivo'
                    ? 'border-gold bg-gold-muted text-gold font-bold shadow-gold-glow'
                    : 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                ⚽ Jota Esportivo
              </button>
              <button
                type="button"
                onClick={() => setEmpresa('jota_tech')}
                className={`py-2 px-2 text-center rounded-lg border text-xs font-medium transition-all ${
                  empresa === 'jota_tech'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 font-bold'
                    : 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                💻 Jota Tech
              </button>
              <button
                type="button"
                onClick={() => setEmpresa('holding')}
                className={`py-2 px-2 text-center rounded-lg border text-xs font-medium transition-all ${
                  empresa === 'holding'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-400 font-bold'
                    : 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                🏢 Holding Geral
              </button>
            </div>
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label mb-1">Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-mono text-sm">R$</span>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  className="input pl-10 font-display text-base font-bold tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="label mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-text-secondary" />
                <span>Data do Lançamento *</span>
              </label>
              <input
                type="date"
                required
                value={dataLancamento}
                onChange={e => setDataLancamento(e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="label mb-1">Descrição / Job *</label>
            <input
              type="text"
              required
              placeholder={tipo === 'receita' ? 'Ex: Mensalidade Contrato Red Bull / Patrocínio' : 'Ex: Diária de filmmaker captação evento / Licença Adobe'}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className="input text-sm"
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="label mb-1 flex items-center gap-1.5">
              <Tag size={13} className="text-text-secondary" />
              <span>Categoria *</span>
            </label>
            <select
              required
              value={categoriaId}
              onChange={e => setCategoriaId(e.target.value)}
              className="input text-sm"
            >
              <option value="">Selecione uma categoria...</option>
              {filteredCategorias.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Cliente e Projeto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label mb-1 flex items-center gap-1.5">
                <User size={13} className="text-text-secondary" />
                <span>Cliente Relacionado</span>
              </label>
              <select
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="input text-xs"
              >
                <option value="">Nenhum cliente vinculado</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.empresa ? `(${c.empresa === 'jota_tech' ? 'Tech' : 'Esportivo'})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label mb-1 flex items-center gap-1.5">
                <Briefcase size={13} className="text-text-secondary" />
                <span>Projeto da Agência</span>
              </label>
              <select
                value={projetoId}
                onChange={e => setProjetoId(e.target.value)}
                className="input text-xs"
              >
                <option value="">Nenhum projeto vinculado</option>
                {projetos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Link do Comprovante */}
          <div>
            <label className="label mb-1 flex items-center gap-1.5">
              <LinkIcon size={13} className="text-text-secondary" />
              <span>Comprovante / Recibo (URL Opcional)</span>
            </label>
            <input
              type="url"
              placeholder="https://link-do-comprovante-ou-drive.com"
              value={comprovanteUrl}
              onChange={e => setComprovanteUrl(e.target.value)}
              className="input text-xs font-mono"
            />
          </div>

          {/* Despesa Recorrente / Custo Fixo */}
          {tipo === 'despesa' && (
            <div className="p-3 bg-surface-elevated rounded-lg border border-border">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={isRecorrente}
                  onChange={e => setIsRecorrente(e.target.checked)}
                  className="checkbox"
                />
                <span className="text-text-primary font-medium">
                  Despesa Fixa / Recorrente Mensal
                </span>
              </label>
              <p className="text-[10px] text-text-secondary mt-1 pl-6">
                Marque se este for um custo mensal fixo (salário, internet, ferramentas como Adobe/AWS). Ele será incluído na linha base da Previsão Financeira.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost text-xs py-2 px-4"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`text-xs py-2 px-5 font-semibold rounded-lg transition-all ${
                tipo === 'receita'
                  ? 'bg-success text-black hover:bg-success/90 font-bold'
                  : 'bg-danger text-white hover:bg-danger/90 font-bold'
              }`}
            >
              {loading ? 'Salvando...' : lancamentoParaEditar ? 'Atualizar Lançamento' : 'Confirmar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
