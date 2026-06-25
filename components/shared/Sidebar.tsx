'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Calendar,
  KanbanSquare,
  UserCog,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks/useProfile'
import { cn, getInitials } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/semana', label: 'Semana', icon: Calendar },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/projetos', label: 'Projetos', icon: KanbanSquare, gestorOnly: true },
  { href: '/equipe', label: 'Equipe', icon: UserCog },
  { href: '/configuracoes', label: 'Config', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useProfile()
  const [collapsed, setCollapsed] = useState(false)

  const isGestor = profile?.role === 'gestor_equipe' || profile?.role === 'gestor_financeiro'
  const visibleItems = navItems.filter(item => {
    if (!isGestor) {
      return item.href === '/semana' || item.href === '/configuracoes'
    }
    return !item.gestorOnly || isGestor
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ── Desktop Sidebar (md+) ── */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-surface border-r border-border transition-all duration-200 h-screen sticky top-0 shrink-0',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-5 border-b border-border',
          collapsed && 'justify-center px-0'
        )}>
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
            <span className="font-display text-black text-base font-bold leading-none">J.</span>
          </div>
          {!collapsed && (
            <div>
              <p className="font-display text-sm font-bold text-text-primary leading-tight">Jota</p>
              <p className="text-[10px] text-text-secondary leading-tight">Esportivo</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center gap-3 px-2.5 py-2.5 rounded text-sm font-medium transition-all duration-150',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'text-text-primary bg-surface-elevated border-l-2 border-gold pl-[9px]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                )}
              >
                <Icon
                  size={18}
                  className={cn(isActive ? 'text-gold' : 'text-text-secondary')}
                />
                {!collapsed && label}
              </Link>
            )
          })}
        </nav>

        {/* User + collapse */}
        <div className="border-t border-border p-2 space-y-0.5">
          {/* User info */}
          {profile && (
            <div className={cn(
              'flex items-center gap-2.5 px-2.5 py-2.5 rounded',
              collapsed && 'justify-center'
            )}>
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
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{profile.nome}</p>
                  <p className="text-[10px] text-text-secondary truncate capitalize">
                    {profile.role?.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sair' : undefined}
            className={cn(
              'flex items-center gap-3 w-full px-2.5 py-2 rounded text-sm text-text-secondary',
              'hover:text-danger hover:bg-danger/10 transition-all duration-150',
              collapsed && 'justify-center'
            )}
          >
            <LogOut size={16} />
            {!collapsed && 'Sair'}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'flex items-center gap-3 w-full px-2.5 py-2 rounded text-sm text-text-secondary',
              'hover:text-text-primary hover:bg-surface-elevated transition-all duration-150',
              collapsed && 'justify-center'
            )}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Recolher</span></>}
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Navigation (< md) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border flex items-stretch safe-area-inset-bottom">
        {visibleItems.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const isActive = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[9px] font-semibold uppercase tracking-wide transition-colors duration-150',
                isActive
                  ? 'text-gold'
                  : 'text-text-secondary'
              )}
            >
              <Icon size={20} className={cn(isActive ? 'text-gold' : 'text-text-secondary')} />
              {label}
            </Link>
          )
        })}
        {/* Logout button on mobile */}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[9px] font-semibold uppercase tracking-wide text-text-secondary hover:text-danger transition-colors duration-150"
        >
          <LogOut size={20} />
          Sair
        </button>
      </nav>
    </>
  )
}
