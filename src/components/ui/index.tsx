'use client'
import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Badge ────────────────────────────────────────────────────────────────
export function Badge({ children, color='blue', className='' }: { children:ReactNode, color?:'blue'|'green'|'amber'|'red'|'gray'|'purple', className?:string }) {
  const map = {
    blue:  {bg:'rgba(249,115,22,.15)', color:'#f97316'},
    green: {bg:'rgba(16,185,129,.13)', color:'#10b981'},
    amber: {bg:'rgba(245,158,11,.13)', color:'#f59e0b'},
    red:   {bg:'rgba(239,68,68,.13)',  color:'#ef4444'},
    gray:  {bg:'rgba(107,114,128,.15)',color:'#9ca3af'},
    purple:{bg:'rgba(124,58,237,.2)',  color:'#a78bfa'},
  }
  const s = map[color]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-bold',className)} style={{background:s.bg,color:s.color}}>{children}</span>
}

// ─── Button ──────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant='primary', size='md', disabled=false, className='' }: { children:ReactNode, onClick?:()=>void, variant?:'primary'|'secondary'|'danger'|'ghost', size?:'sm'|'md'|'lg', disabled?:boolean, className?:string }) {
  const v = {
    primary:   {bg:'linear-gradient(135deg,#f97316,#c85a00)', color:'#fff', hov:'brightness(1.1)'},
    secondary: {bg:'transparent',   color:'var(--t2)',    border:'1px solid var(--bd)'},
    danger:    {bg:'var(--rd)',      color:'#fff',         hov:'brightness(1.1)'},
    ghost:     {bg:'transparent',   color:'var(--t3)',    border:'none'},
  }[variant]
  const sz = { sm:'px-2.5 py-1.5 text-xs rounded-lg', md:'px-4 py-2.5 text-sm rounded-xl', lg:'px-5 py-3 text-sm rounded-xl w-full' }[size]
  return (
    <button onClick={onClick} disabled={disabled} className={cn('inline-flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer border-none',sz,className)}
      style={{background:v.bg,color:v.color,border:(v as any).border||'none',opacity:disabled?.5:1,cursor:disabled?'not-allowed':'pointer',fontFamily:'Sora,system-ui,sans-serif'}}>
      {children}
    </button>
  )
}

// ─── Input ──────────────────────────────────────────────────────────────
export function Input({ label, value, onChange, placeholder='', type='text', required=false, disabled=false, className='' }: any) {
  return (
    <div className={cn('mb-2.5',className)}>
      {label && <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>{label}{required&&<span style={{color:'var(--rd)'}}> *</span>}</label>}
      <input type={type} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="w-full rounded-xl px-3 py-2 text-xs outline-none transition-all"
        style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}
        onFocus={e=>{e.target.style.borderColor='rgba(249,115,22,.6)';e.target.style.boxShadow='0 0 10px rgba(249,115,22,.12)'}} onBlur={e=>{e.target.style.borderColor='var(--bd)';e.target.style.boxShadow='none'}} />
    </div>
  )
}

// ─── Select ──────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options, required=false, className='' }: any) {
  return (
    <div className={cn('mb-2.5',className)}>
      {label && <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>{label}{required&&<span style={{color:'var(--rd)'}}> *</span>}</label>}
      <select value={value||''} onChange={e=>onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2 text-xs outline-none transition-all cursor-pointer"
        style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}
        onFocus={e=>{e.target.style.borderColor='rgba(249,115,22,.6)';e.target.style.boxShadow='0 0 10px rgba(249,115,22,.12)'}} onBlur={e=>{e.target.style.borderColor='var(--bd)';e.target.style.boxShadow='none'}}>
        {options.map((o: any) => <option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
      </select>
    </div>
  )
}

// ─── Textarea ────────────────────────────────────────────────────────────
export function Textarea({ label, value, onChange, placeholder='', rows=3, className='' }: any) {
  return (
    <div className={cn('mb-2.5',className)}>
      {label && <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>{label}</label>}
      <textarea value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full rounded-xl px-3 py-2 text-xs outline-none transition-all resize-none"
        style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',lineHeight:1.5}}
        onFocus={e=>{e.target.style.borderColor='rgba(249,115,22,.6)';e.target.style.boxShadow='0 0 10px rgba(249,115,22,.12)'}} onBlur={e=>{e.target.style.borderColor='var(--bd)';e.target.style.boxShadow='none'}} />
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────
export function Card({ children, className='', onClick }: { children:ReactNode, className?:string, onClick?:()=>void }) {
  return (
    <div onClick={onClick} className={cn('rounded-xl p-3',className,onClick?'cursor-pointer':'')}
      style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:'2px solid rgba(249,115,22,.4)'}}>
      {children}
    </div>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────
export function SH({ label, action }: { label:string, action?:ReactNode }) {
  return (
    <div className="flex items-center justify-between my-3">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{color:'var(--t2)'}}>
        <div className="w-1 h-3 rounded-sm" style={{background:'linear-gradient(180deg,#f97316,#ea6a00)',boxShadow:'0 0 6px rgba(249,115,22,.6)'}}/>
        {label}
      </div>
      {action}
    </div>
  )
}

// ─── KPI ─────────────────────────────────────────────────────────────────
export function KPI({ num, label, color='blue' }: { num:number|string, label:string, color?:'blue'|'green'|'amber'|'red' }) {
  const c = {blue:'var(--cy)',green:'var(--gn)',amber:'var(--am)',red:'var(--rd)'}[color]
  return (
    <div className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)',borderTop:'2px solid '+c}}>
      <div className="font-bebas text-3xl leading-none" style={{color:c,textShadow:`0 0 12px ${c}88`}}>{num}</div>
      <div className="text-xs mt-0.5" style={{color:'var(--t3)',fontSize:'8px',textTransform:'uppercase',letterSpacing:'.3px'}}>{label}</div>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────
export function Empty({ icon='📋', text='Nenhum item encontrado' }: { icon?:string, text?:string }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-2 opacity-40">{icon}</div>
      <div className="text-xs" style={{color:'var(--t3)'}}>{text}</div>
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer }: { open:boolean, onClose:()=>void, title:string, children:ReactNode, footer?:ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" style={{background:'rgba(0,0,0,.8)',backdropFilter:'blur(6px)'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="w-full max-w-lg rounded-t-2xl overflow-y-auto" style={{background:'var(--bg2)',border:'1px solid var(--bd)',borderBottom:'none',maxHeight:'92vh',scrollbarWidth:'none'}}>
        <div className="w-9 h-1 rounded-sm mx-auto mt-3 mb-0" style={{background:'var(--t3)'}}/>
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10" style={{background:'var(--bg2)',borderBottom:'1px solid var(--bd)'}}>
          <div className="text-sm font-bold">{title}</div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{background:'var(--s2)',border:'none',color:'var(--t2)',cursor:'pointer'}}>✕</button>
        </div>
        <div className="px-4 pt-3 pb-2">{children}</div>
        {footer && <div className="px-4 pb-5 pt-3 flex gap-2 sticky bottom-0" style={{background:'var(--bg2)',borderTop:'1px solid var(--bd)'}}>{footer}</div>}
      </div>
    </div>
  )
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────
export function useConfirm() {
  const [state, setState] = useState<{msg:string,resolve:(v:boolean)=>void}|null>(null)
  const confirm = (msg: string) => new Promise<boolean>(res => setState({msg,resolve:res}))
  const dialog = state ? (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-5" style={{background:'rgba(0,0,0,.85)',backdropFilter:'blur(8px)'}}>
      <div className="rounded-2xl p-6 text-center" style={{background:'var(--bg2)',border:'1px solid var(--bd)',maxWidth:300,width:'100%'}}>
        <div className="text-3xl mb-3">⚠️</div>
        <div className="text-sm font-semibold mb-5 leading-relaxed">{state.msg}</div>
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{background:'transparent',border:'1px solid var(--bd)',color:'var(--t2)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif'}}
            onClick={()=>{state.resolve(false);setState(null)}}>Cancelar</button>
          <button className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{background:'var(--rd)',border:'none',color:'#fff',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif'}}
            onClick={()=>{state.resolve(true);setState(null)}}>Confirmar</button>
        </div>
      </div>
    </div>
  ) : null
  return { confirm, dialog }
}

// ─── Search ──────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder='Buscar...', action }: any) {
  return (
    <div className="flex gap-2 mb-3">
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
        style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
        onFocus={e=>{e.target.style.borderColor='rgba(249,115,22,.6)';e.target.style.boxShadow='0 0 10px rgba(249,115,22,.12)'}} onBlur={e=>{e.target.style.borderColor='var(--bd)';e.target.style.boxShadow='none'}} />
      {action}
    </div>
  )
}

// ─── Chips ───────────────────────────────────────────────────────────────
export function Chips({ options, value, onChange }: { options:{label:string,value:string}[], value:string, onChange:(v:string)=>void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
      {options.map(o => (
        <button key={o.value} onClick={()=>onChange(o.value)}
          className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border"
          style={{background:value===o.value?'var(--cy)':'transparent',color:value===o.value?'#000':'var(--t2)',borderColor:value===o.value?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
