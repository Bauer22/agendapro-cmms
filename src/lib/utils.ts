import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export const td = () => new Date().toISOString().split('T')[0]
export const pad = (n: number) => String(n).padStart(2,'0')
export const fmtD = (d?: string|null) => {
  if(!d) return '—'
  const [y,m,dd] = d.split('-')
  return `${dd}/${m}/${y}`
}
export const fmtDT = (iso?: string|null) => {
  if(!iso) return '—'
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fmtH = (h?: number|null) => h == null ? '—' : `${Number(h).toFixed(0)}h`
export const daysBetween = (a?: string, b?: string) => {
  if(!a||!b) return null
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}
export const addDays = (ds: string, n: number) => {
  const d = new Date(ds+'T12:00:00'); d.setDate(d.getDate()+n)
  return d.toISOString().split('T')[0]
}
export const PERIOD_DAYS: Record<string,number> = {
  daily:1,weekly:7,biweekly:14,monthly:30,bimonthly:60,
  quarterly:90,semiannual:180,annual:365
}
export const PERIOD_LABEL: Record<string,string> = {
  daily:'Diária',weekly:'Semanal',biweekly:'Quinzenal',monthly:'Mensal',
  bimonthly:'Bimestral',quarterly:'Trimestral',semiannual:'Semestral',annual:'Anual'
}
export const PRIO_LABEL: Record<string,string> = {
  critical:'🟣 Crítica',high:'🔴 Alta',medium:'🟡 Média',low:'🟢 Baixa'
}
export const PRIO_COLOR: Record<string,string> = {
  critical:'#a78bfa',high:'#ef4444',medium:'#f59e0b',low:'#10b981'
}
export const STATUS_INFO: Record<string,{label:string,color:string,bg:string}> = {
  open:     {label:'Aberta',      color:'#60a5fa', bg:'rgba(96,165,250,.15)'},
  progress: {label:'Em andamento',color:'#f59e0b', bg:'rgba(245,158,11,.15)'},
  done:     {label:'Concluída',   color:'#10b981', bg:'rgba(16,185,129,.15)'},
  cancelled:{label:'Cancelada',   color:'#6b7280', bg:'rgba(107,114,128,.15)'},
}
export const ROLES: Record<string,{label:string,perms:string[]}> = {
  admin:      {label:'Administrador', perms:['all']},
  supervisor: {label:'Supervisor',    perms:['os','mach','maint','pm','tasks','reports','settings']},
  operator:   {label:'Operador',      perms:['os','maint','pm','tasks','checklist']},
  viewer:     {label:'Consulta',      perms:['reports']},
}
export const DPT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
export const MPT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
export const MFULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export function oilStatus(current: number, lastOil: number, interval: number) {
  const used = current - lastOil
  const remaining = interval - used
  const pct = Math.min(100, Math.round(used / interval * 100))
  if (remaining > interval * 0.3) return { color:'gn', label:`${Math.round(remaining)}h restantes`, pct }
  if (remaining > 0) return { color:'am', label:`${Math.round(remaining)}h restantes`, pct }
  return { color:'rd', label:`${Math.abs(Math.round(remaining))}h atrasado`, pct }
}
