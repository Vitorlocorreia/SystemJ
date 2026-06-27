import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import type { StatusCliente } from '@/types'

const statusLabel: Record<StatusCliente, string> = {
  prospecto: 'Prospecto',
  ativo: 'Ativo',
  inativo: 'Inativo',
}

const statusClass: Record<StatusCliente, string> = {
  prospecto: 'badge-secondary',
  ativo: 'badge-success',
  inativo: 'badge-danger',
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
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

  const { status, q } = await searchParams

  let query = supabase
    .from('clientes')
    .select('id, nome, cnpj_cpf, email, telefone, segmento, status, valor_contrato, created_at')
    .order('created_at', { ascending: false })

  if (status && status !== 'todos') {
    query = query.eq('status', status as StatusCliente)
  }
  if (q) {
    query = query.ilike('nome', `%${q}%`)
  }

  const { data: clientes, error } = await query

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-display-md text-text-primary">Clientes</h1>
          <p className="text-text-secondary text-sm mt-1">{clientes?.length ?? 0} registros</p>
        </div>
        <Link href="/clientes/novo" className="btn-primary flex items-center gap-2 self-start">
          <Plus size={16} />
          Novo cliente
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome..."
            className="input pl-9 w-64"
          />
        </form>

        <div className="flex gap-1.5">
          {(['todos', 'prospecto', 'ativo', 'inativo'] as const).map((s) => (
            <Link
              key={s}
              href={s === 'todos' ? '/clientes' : `/clientes?status=${s}`}
              className={`px-3.5 py-2 rounded text-xs font-medium transition-all duration-150 ${
                (status ?? 'todos') === s
                  ? 'bg-gold text-black'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary border border-border'
              }`}
            >
              {s === 'todos' ? 'Todos' : statusLabel[s]}
            </Link>
          ))}
        </div>
      </div>

      {/* Table — desktop (md+) */}
      <div className="hidden md:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Cliente</th>
              <th className="text-left px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Segmento</th>
              <th className="text-left px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Contato</th>
              <th className="text-left px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3.5 text-text-secondary font-medium text-xs uppercase tracking-wider">Contrato</th>
            </tr>
          </thead>
          <tbody>
            {clientes?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-text-secondary text-sm">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
            {clientes?.map((cliente) => (
              <tr key={cliente.id} className="border-b border-border last:border-0 table-row-hover group">
                <td className="px-5 py-4">
                  <Link href={`/clientes/${cliente.id}`} className="block">
                    <p className="font-medium text-text-primary group-hover:text-gold transition-colors duration-150">
                      {cliente.nome}
                    </p>
                    {cliente.cnpj_cpf && (
                      <p className="text-text-secondary text-xs mt-0.5">{cliente.cnpj_cpf}</p>
                    )}
                  </Link>
                </td>
                <td className="px-5 py-4 text-text-secondary">{cliente.segmento ?? '—'}</td>
                <td className="px-5 py-4 text-text-secondary">{cliente.email ?? cliente.telefone ?? '—'}</td>
                <td className="px-5 py-4">
                  <span className={statusClass[cliente.status as StatusCliente]}>
                    {statusLabel[cliente.status as StatusCliente]}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-display tabular-nums text-text-primary">
                  {cliente.valor_contrato
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor_contrato)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card list — mobile */}
      <div className="md:hidden space-y-2">
        {clientes?.length === 0 && (
          <p className="text-center text-text-secondary text-sm py-8">Nenhum cliente encontrado.</p>
        )}
        {clientes?.map((cliente) => (
          <Link
            key={cliente.id}
            href={`/clientes/${cliente.id}`}
            className="block card-elevated hover:border-gold/30 transition-all duration-150 group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-text-primary group-hover:text-gold transition-colors truncate">
                  {cliente.nome}
                </p>
                {cliente.segmento && (
                  <p className="text-text-secondary text-xs mt-0.5 truncate">{cliente.segmento}</p>
                )}
              </div>
              <span className={statusClass[cliente.status as StatusCliente]}>
                {statusLabel[cliente.status as StatusCliente]}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-xs text-text-secondary">{cliente.email ?? cliente.telefone ?? '—'}</span>
              <span className="font-display text-xs tabular-nums text-text-primary">
                {cliente.valor_contrato
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor_contrato)
                  : ''}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
