import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfiguracoesForm from './ConfiguracoesForm'
import { isMolaProfile } from '@/lib/utils'

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

  const isMola = isMolaProfile(profile)
  const isGestor = !isMola && (profile.role === 'owner' || profile.role === 'gestor_equipe' || profile.role === 'gestor_financeiro' || (profile.nome?.toLowerCase()?.includes('rennan') || profile.nome?.toLowerCase()?.includes('renan')))
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
