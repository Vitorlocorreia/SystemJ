import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  
  if (isGestor) {
    redirect('/dashboard')
  } else {
    redirect('/semana')
  }
}

