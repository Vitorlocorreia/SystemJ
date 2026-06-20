'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }

    load()
  }, [])

  return { profile, loading }
}

export function hasFullAccess(role: Profile['role'] | undefined) {
  return role === 'gestor_equipe' || role === 'gestor_financeiro'
}

export function isOperacional(role: Profile['role'] | undefined) {
  return role === 'tecnologia' || role === 'filmmaker' || role === 'design_grafico'
}
