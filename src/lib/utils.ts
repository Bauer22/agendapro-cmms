export const fmtD = (d?: string) => {
  if (!d) return '—'
  try { const [y,m,day] = d.split('T')[0].split('-'); return `${day}/${m}/${y}` } catch { return d }
}
export const fmtDT = (d?: string) => {
  if (!d) return '—'
  try { const dt = new Date(d); const hh=String(dt.getHours()).padStart(2,'0'); const mm=String(dt.getMinutes()).padStart(2,'0'); return `${fmtD(d)} ${hh}:${mm}` } catch { return fmtD(d) }
}
export const td = () => new Date().toISOString().split('T')[0]

export const STATUS_INFO: Record<string, {label:string; color:string}> = {
  open:      { label:'Aberta',      color:'#3b82f6' },
  progress:  { label:'Andamento',   color:'#f59e0b' },
  done:      { label:'Concluída',   color:'#22c55e' },
  cancelled: { label:'Cancelada',   color:'#6b7280' },
}
export const PRIO_LABEL: Record<string,string> = {
  low:'🟢 Baixa', medium:'🟡 Média', high:'🔴 Alta', critical:'🟣 Crítica'
}
export const PRIO_COLOR: Record<string,string> = {
  low:'#22c55e', medium:'#f59e0b', high:'#ef4444', critical:'#a78bfa'
}
export const PERIOD_LABEL: Record<string,string> = {
  daily:'Diário', weekly:'Semanal', biweekly:'Quinzenal',
  monthly:'Mensal', quarterly:'Trimestral', semiannual:'Semestral', annual:'Anual'
}
export const ROLES: Record<string,{label:string,perms:string[]}> = {
  superadmin: { label:'Super Admin',   perms:['all'] },
  admin:      { label:'Administrador',  perms:['all'] },
  supervisor: { label:'Supervisor',     perms:['os','maint','pm','tasks','parts','reports','machines'] },
  operator:   { label:'Operador',       perms:['os','maint','pm','tasks'] },
  producao:   { label:'Produção',       perms:['production','wood','sales'] },
  viewer:     { label:'Consulta',       perms:['reports'] },
}

// Módulos de menu liberados por perfil quando o usuário NÃO tem módulos
// configurados individualmente (fallback de navegação em app/page.tsx).
export const ROLE_MODULES: Record<string,string[]> = {
  producao: ['dashboard','production','wood','sales'],
}
export const DPT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
export const MPT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
export const MFULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export const fmtH = (h?: number) => h != null ? `${h.toLocaleString('pt-BR')}h` : '—'

export function oilStatus(current: number, lastOil: number, interval: number) {
  const diff = current - lastOil
  const pct  = interval > 0 ? (diff / interval) * 100 : 0
  if (pct >= 100) return { label: '🔴 Troca vencida',   color: 'rd' }
  if (pct >= 80)  return { label: '🟡 Trocar em breve', color: 'am' }
  return { label: '🟢 Em dia', color: 'gn' }
}
