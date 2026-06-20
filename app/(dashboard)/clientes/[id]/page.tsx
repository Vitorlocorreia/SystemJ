import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Briefcase, Calendar, MessageSquare, DollarSign, Activity, FileText, User } from 'lucide-react'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import type { StatusCliente } from '@/types'
import ExcluirClienteButton from '@/components/clientes/ExcluirClienteButton'
import RegistrarInteracaoModal from '@/components/clientes/RegistrarInteracaoModal'

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

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [
    { data: cliente },
    { data: projetos },
    { data: projetosKanban },
    { data: interacoes },
    { data: profile }
  ] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', id).single(),
    supabase.from('projetos').select('id, nome, status, prazo, responsavel:profiles(nome)').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase.from('projetos_kanban').select('id, titulo, status, prazo, responsavel:profiles!responsavel_id(nome)').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase.from('interacoes').select('*, autor:profiles(nome)').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('role').eq('user_id', user.id).single()
  ])

  if (!cliente) notFound()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'

  // Calculations for KPIs
  const totalProjetos = (projetos?.length ?? 0) + (projetosKanban?.length ?? 0)
  const ativosProjetos = 
    (projetos?.filter((p: any) => p.status !== 'concluido' && p.status !== 'cancelado').length ?? 0) +
    (projetosKanban?.filter((p: any) => p.status !== 'concluido' && p.status !== 'cancelado').length ?? 0)

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/clientes" className="btn-ghost p-2 -ml-2">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-display-md text-text-primary">{cliente.nome}</h1>
              <span className={statusClass[cliente.status as StatusCliente]}>
                {statusLabel[cliente.status as StatusCliente]}
              </span>
            </div>
            {cliente.segmento && (
              <p className="text-text-secondary text-sm mt-1">{cliente.segmento}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isGestor && (
            <ExcluirClienteButton
              clienteId={cliente.id}
              clienteNome={cliente.nome}
              isGestor={isGestor}
            />
          )}
          <Link href={`/clientes/${id}/editar`} className="btn-primary flex items-center gap-2">
            <Edit size={14} />
            Editar Informações
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-elevated relative overflow-hidden flex flex-col justify-between p-5 group hover:border-gold/20 transition-all duration-300">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Contrato Mensal</span>
            <DollarSign size={16} className="text-gold opacity-60" />
          </div>
          <div className="mt-4">
            <p className="kpi-number-gold">{formatCurrency(cliente.valor_contrato ?? 0)}</p>
            <p className="text-[10px] text-text-secondary mt-1">
              Faturamento anual estimado: {formatCurrency((cliente.valor_contrato ?? 0) * 12)}
            </p>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-gold/5 rounded-full blur-2xl group-hover:bg-gold/10 transition-all duration-300 translate-x-8 translate-y-8" />
        </div>

        <div className="card-elevated relative overflow-hidden flex flex-col justify-between p-5 group hover:border-gold/20 transition-all duration-300">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Projetos</span>
            <Briefcase size={16} className="text-text-secondary opacity-60" />
          </div>
          <div className="mt-4">
            <p className="kpi-number">{ativosProjetos} ativos</p>
            <p className="text-[10px] text-text-secondary mt-1">
              Total de {totalProjetos} projetos vinculados
            </p>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-300 translate-x-8 translate-y-8" />
        </div>

        <div className="card-elevated relative overflow-hidden flex flex-col justify-between p-5 group hover:border-gold/20 transition-all duration-300">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Interações</span>
            <Activity size={16} className="text-text-secondary opacity-60" />
          </div>
          <div className="mt-4">
            <p className="kpi-number">{interacoes?.length ?? 0}</p>
            <p className="text-[10px] text-text-secondary mt-1 truncate">
              Último contato: {interacoes && interacoes.length > 0 ? formatDate(interacoes[0].created_at) : 'Nenhum'}
            </p>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-300 translate-x-8 translate-y-8" />
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Client Info Summary Card */}
        <div className="card space-y-5 md:col-span-1 h-fit">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest border-b border-border/40 pb-2">Informações Cadastrais</h2>
          <div className="space-y-4">
            {[
              { label: 'CNPJ/CPF', value: cliente.cnpj_cpf },
              { label: 'E-mail principal', value: cliente.email },
              { label: 'Telefone contato', value: cliente.telefone },
              { label: 'Segmento de atuação', value: cliente.segmento },
              { label: 'Registrado em', value: formatDate(cliente.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="group/item">
                <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm font-medium text-text-primary group-hover/item:text-gold transition-colors duration-150">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Projects & Interactions */}
        <div className="md:col-span-2 space-y-6">
          {/* Projects Kanban */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                Projetos de Longo Prazo ({projetosKanban?.length ?? 0})
              </h2>
            </div>
            {projetosKanban?.length === 0 ? (
              <p className="text-text-secondary text-sm italic">Nenhum projeto de longo prazo registrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(projetosKanban as any[])?.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-border bg-surface-elevated/40 hover:border-gold/30 hover:shadow-lg hover:shadow-black/20 transition-all duration-150 flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="badge-secondary text-[9px] font-bold tracking-wider uppercase py-0.5">
                          {p.status.replace(/_/g, ' ')}
                        </span>
                        {p.prazo && (
                          <span className="text-[9px] text-text-secondary flex items-center gap-1">
                            <Calendar size={10} />
                            {formatDate(p.prazo)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-text-primary mt-2 group-hover:text-gold transition-colors">
                        {p.titulo}
                      </p>
                    </div>
                    {p.responsavel && (
                      <div className="flex items-center gap-1.5 border-t border-border/40 pt-2 text-[10px] text-text-secondary">
                        <User size={10} />
                        <span>Responsável: {p.responsavel.nome}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational projects (demandas) */}
          <div className="card space-y-4">
            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest border-b border-border/40 pb-2">
              Demandas Operacionais ({projetos?.length ?? 0})
            </h2>
            {projetos?.length === 0 ? (
              <p className="text-text-secondary text-sm italic">Nenhuma demanda operacional registrada.</p>
            ) : (
              <div className="space-y-2">
                {(projetos as any[])?.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projetos/${p.id}`}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-surface-elevated/40 border border-border hover:border-gold/30 transition-all duration-150"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-text-primary">{p.nome}</p>
                      {p.prazo && (
                        <p className="text-[10px] text-text-secondary flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          Prazo: {formatDate(p.prazo)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="badge-secondary capitalize text-xs">{p.status.replace(/_/g, ' ')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Interactions timeline widget */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                Linha do Tempo de Interações ({interacoes?.length ?? 0})
              </h2>
              <RegistrarInteracaoModal clienteId={id} clienteNome={cliente.nome} />
            </div>

            {interacoes?.length === 0 ? (
              <p className="text-text-secondary text-sm italic">Nenhum registro de contato ou reunião registrado.</p>
            ) : (
              <div className="relative pl-6 border-l border-border/60 ml-3 space-y-6 pt-2">
                {(interacoes as any[])?.map((i) => (
                  <div key={i.id} className="relative group/timeline">
                    {/* timeline bullet node */}
                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-background border-2 border-gold flex items-center justify-center group-hover/timeline:scale-110 transition-transform">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary">
                            {i.autor?.nome ?? 'Usuário'}
                          </span>
                          <span className="text-[10px] text-text-secondary">
                            {formatDate(i.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-surface-elevated/40 border border-border/60 rounded-xl p-3.5 hover:border-gold/10 transition-colors">
                        <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                          {i.descricao}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
