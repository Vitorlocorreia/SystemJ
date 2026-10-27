'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useProfile } from '@/lib/hooks/useProfile'
import { getInitials, isMolaProfile } from '@/lib/utils'
import GestorNotificationBell from './GestorNotificationBell'
import { Building2, ChevronRight, Sparkles } from 'lucide-react'

const ROUTE_LABELS: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão Geral Executiva' },
  '/semana': { title: 'Planejamento Semanal', subtitle: 'Organização de Entregas' },
  '/clientes': { title: 'Gestão de Clientes', subtitle: 'Contratos e Relacionamento' },
  '/projetos': { title: 'Projetos & Jobs', subtitle: 'Acompanhamento Operacional' },
  '/demandas': { title: 'Quadro de Demandas', subtitle: 'Tarefas e Prazos' },
  '/financeiro': { title: 'Financeiro Corporativo', subtitle: 'Fluxo de Caixa e Cobranças' },
  '/equipe': { title: 'Equipe & Colaboradores', subtitle: 'Membros e Atribuições' },
  '/design': { title: 'Demandas de Design', subtitle: 'Fila Criativa' },
  '/configuracoes': { title: 'Configurações', subtitle: 'Preferências do Sistema' },
  '/notas': { title: 'Bloco de Notas', subtitle: 'Anotações Rápidas' }
}

export default function TopHeader() {
  const pathname = usePathname()
  const { profile } = useProfile()

  const isMola = isMolaProfile(profile)
  const matchingRoute = Object.keys(ROUTE_LABELS).find(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )
  const currentRouteInfo = matchingRoute ? ROUTE_LABELS[matchingRoute] : { title: 'Sistema Interno' }

  return (
    <header className="hidden md:flex items-center justify-between h-14 px-6 border-b border-border bg-surface/40 backdrop-blur-md shrink-0 sticky top-0 z-30">
      {/* Lado Esquerdo: Breadcrumb / Título da Seção */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">SystemJ</span>
        <ChevronRight size={13} className="text-text-secondary/50" />
        <h2 className="font-display text-sm font-bold text-text-primary">
          {currentRouteInfo.title}
        </h2>
        {isMola && (
          <span className="ml-2 text-[10px] font-bold text-gold bg-gold-muted px-2 py-0.5 rounded-full border border-gold/30 flex items-center gap-1">
            ⚽ Jota Esportivo
          </span>
        )}
      </div>

      {/* Lado Direito: Sininho dos Gestores e Perfil */}
      <div className="flex items-center gap-3">
        {/* Sininho de Notificações exclusivo para Gestores */}
        <GestorNotificationBell />

        {/* Perfil Compacto */}
        {profile && (
          <div className="flex items-center gap-2.5 pl-2 border-l border-border/60">
            <div className="w-7 h-7 rounded-full bg-gold-muted border border-gold/30 flex items-center justify-center shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gold text-[10px] font-bold">
                  {getInitials(profile.nome)}
                </span>
              )}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-text-primary leading-tight truncate max-w-[120px]">
                {profile.nome?.split(' ')[0]}
              </p>
              <p className="text-[10px] text-text-secondary leading-tight capitalize">
                {profile.cargo || (profile.role === 'owner' ? 'Owner' : profile.role?.replace(/_/g, ' '))}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
