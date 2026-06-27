import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Upload, Download } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { TipoLancamento } from '@/types'

export default async function FinanceiroPage() {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  if (profile?.role === 'design_grafico') redirect('/design')
  if (!isGestor) redirect('/semana')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [{ data: lancamentos }, { data: lancamentosDoMes }] = await Promise.all([
    supabase
      .from('lancamentos')
      .select('*, categoria:categorias_financeiro(nome, cor), cliente:clientes(nome)')
      .order('data_lancamento', { ascending: false })
      .limit(50),
    supabase
      .from('lancamentos')
      .select('tipo, valor')
      .gte('data_lancamento', startOfMonth),
  ])

  const receitas = lancamentosDoMes?.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0) ?? 0
  const despesas = lancamentosDoMes?.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0) ?? 0
  const margem = receitas - despesas

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-display-md text-text-primary">Financeiro</h1>
          <p className="text-text-secondary text-sm mt-1">
            {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/financeiro/importar" className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14} />
            Importar
          </Link>
          <Link href="/financeiro/novo" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} />
            Lançamento
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-success/20">
          <p className="label">Receitas do Mês</p>
          <p className="kpi-number text-success mt-1">{formatCurrency(receitas)}</p>
        </div>
        <div className="card border-danger/20">
          <p className="label">Despesas do Mês</p>
          <p className="kpi-number text-danger mt-1">{formatCurrency(despesas)}</p>
        </div>
        <div className={`card ${margem >= 0 ? 'border-gold/30 shadow-gold-glow' : 'border-danger/20'}`}>
          <p className="label">Margem Líquida</p>
          <p className={`kpi-number mt-1 ${margem >= 0 ? 'text-gold' : 'text-danger'}`}>
            {formatCurrency(margem)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-text-primary">Lançamentos recentes</p>
          <button className="btn-ghost flex items-center gap-1.5 text-xs">
            <Download size={12} />
            Exportar
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Data</th>
              <th className="text-left px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Descrição</th>
              <th className="text-left px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Categoria</th>
              <th className="text-left px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Cliente</th>
              <th className="text-right px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-text-secondary text-sm">
                  Nenhum lançamento registrado.
                </td>
              </tr>
            )}
            {lancamentos?.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0 table-row-hover">
                <td className="px-5 py-3.5 text-text-secondary text-xs">{formatDate(l.data_lancamento)}</td>
                <td className="px-5 py-3.5 text-text-primary">{l.descricao}</td>
                <td className="px-5 py-3.5">
                  {(l.categoria as { nome: string; cor: string } | null) ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: (l.categoria as { nome: string; cor: string }).cor }}
                      />
                      <span className="text-text-secondary text-xs">{(l.categoria as { nome: string; cor: string }).nome}</span>
                    </span>
                  ) : (
                    <span className="text-text-secondary text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-text-secondary text-xs">
                  {(l.cliente as { nome: string } | null)?.nome ?? '—'}
                </td>
                <td className={`px-5 py-3.5 text-right font-display font-semibold tabular-nums ${
                  l.tipo === 'receita' ? 'text-success' : 'text-danger'
                }`}>
                  {l.tipo === 'despesa' ? '−' : '+'}{formatCurrency(l.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
