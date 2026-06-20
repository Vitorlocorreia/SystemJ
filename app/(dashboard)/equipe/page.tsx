import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInitials } from '@/lib/utils'

const roleLabel: Record<string, string> = {
  gestor_equipe: 'Gestor de Equipe',
  gestor_financeiro: 'Gestor Financeiro',
  tecnologia: 'Tecnologia',
  filmmaker: 'Filmmaker',
  design_grafico: 'Design Gráfico',
}

export default async function EquipePage() {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membros } = await supabase
    .from('profiles')
    .select('*')
    .order('nome')

  // Get task counts per member
  const { data: taskCounts } = await supabase
    .from('tarefas')
    .select('responsavel_id')
    .in('status', ['a_fazer', 'em_andamento'])

  const countByMembro = (taskCounts as { responsavel_id: string | null }[] ?? []).reduce((acc: Record<string, number>, t) => {
    if (t.responsavel_id) {
      acc[t.responsavel_id] = (acc[t.responsavel_id] ?? 0) + 1
    }
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-display-md text-text-primary">Equipe</h1>
        <p className="text-text-secondary text-sm mt-1">{membros?.length ?? 0} membros</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {membros?.map((membro) => {
          const tarefasAbertas = countByMembro[membro.id] ?? 0

          return (
            <div key={membro.id} className="card hover:border-gold/20 transition-all duration-200 group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gold-muted border border-gold/20 flex items-center justify-center shrink-0">
                  <span className="font-display text-gold font-bold text-lg">
                    {getInitials(membro.nome)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate group-hover:text-gold transition-colors duration-150">
                    {membro.nome}
                  </p>
                  <p className="text-text-secondary text-xs mt-0.5">
                    {roleLabel[membro.role] ?? membro.role}
                  </p>
                  {membro.cargo && (
                    <p className="text-text-secondary text-xs">{membro.cargo}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <p className="text-text-secondary text-xs">Tarefas em aberto</p>
                <span className={`font-display font-bold tabular-nums ${
                  tarefasAbertas > 5 ? 'text-danger' :
                  tarefasAbertas > 2 ? 'text-gold' :
                  'text-text-primary'
                }`}>
                  {tarefasAbertas}
                </span>
              </div>
            </div>
          )
        })}

        {membros?.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 text-center py-12 text-text-secondary">
            Nenhum membro cadastrado.
          </div>
        )}
      </div>
    </div>
  )
}
