import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isFilmmakerProfile } from '@/lib/utils'

export default async function Home() {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nome, cargo')
    .eq('user_id', user.id)
    .single()

  const isFilmmaker = isFilmmakerProfile(profile)
  const isGestor = !isFilmmaker && (profile?.role === 'owner' || profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro' || (profile?.nome?.toLowerCase()?.includes('mola') || profile?.nome?.toLowerCase()?.includes('rennan') || profile?.nome?.toLowerCase()?.includes('renan')))
  const isDesign = profile?.role === 'design_grafico'
  
  if (isDesign) {
    redirect('/design')
  } else if (isFilmmaker) {
    redirect('/semana')
  } else if (isGestor) {
    redirect('/dashboard')
  } else {
    redirect('/semana')
  }
}

