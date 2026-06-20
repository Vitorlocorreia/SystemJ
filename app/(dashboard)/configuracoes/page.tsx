import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfiguracoesForm from './ConfiguracoesForm'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch logged in profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const isGestor = profile.role === 'gestor_equipe' || profile.role === 'gestor_financeiro'
  let categorias = []

  if (isGestor) {
    const { data } = await supabase
      .from('categorias_financeiro')
      .select('*')
      .order('nome')
    categorias = data ?? []
  }

  return (
    <ConfiguracoesForm
      profile={profile}
      categorias={categorias}
      isGestor={isGestor}
    />
  )
}
