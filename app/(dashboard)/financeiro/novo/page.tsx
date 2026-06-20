import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NovoLancamentoForm from './NovoLancamentoForm'

export default async function NovoLancamentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch financial categories, clients, and projects
  const [
    { data: categorias },
    { data: clientes },
    { data: projetos }
  ] = await Promise.all([
    supabase.from('categorias_financeiro').select('id, nome, tipo, cor').order('nome'),
    supabase.from('clientes').select('id, nome').order('nome'),
    supabase.from('projetos').select('id, nome').order('nome'),
  ])

  return (
    <NovoLancamentoForm
      categorias={categorias ?? []}
      clientes={clientes ?? []}
      projetos={projetos ?? []}
    />
  )
}
