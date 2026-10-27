import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: string | null) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function isMolaProfile(profile?: { id?: string; user_id?: string; nome?: string | null } | null): boolean {
  if (!profile) return false
  if (profile.id === '71783872-5240-4f64-add8-6b7859065376') return true
  if (profile.user_id === 'df1261ea-2fa1-409a-8089-65c7e901e532') return true
  return profile.nome?.toLowerCase().includes('mola') ?? false
}
