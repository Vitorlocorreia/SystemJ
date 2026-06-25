'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos. Verifique suas credenciais.')
      setLoading(false)
      return
    }

    // Buscar role do usuário para redirecionar corretamente
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .single()

    const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'

    router.push(isGestor ? '/dashboard' : '/semana')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mb-5 shadow-gold-glow">
            <span className="font-display text-black text-3xl font-bold leading-none">J.</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
            Jota Esportivo
          </h1>
          <p className="text-text-secondary text-sm mt-1">Sistema interno</p>
        </div>

        {/* Card */}
        <div className="card border-border/60">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">E-mail</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="input"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Senha</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded px-3 py-2.5 text-sm text-danger animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-secondary mt-6">
          Acesso restrito à equipe Jota
        </p>
      </div>
    </main>
  )
}
