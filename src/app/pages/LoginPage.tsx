'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function login() {
    if (!email || !pass) { setErr('Preencha e-mail e senha.'); return }
    setLoading(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) {
      const msgs: Record<string,string> = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed': 'E-mail não confirmado.',
        'Too many requests': 'Muitas tentativas. Aguarde.',
      }
      setErr(msgs[error.message] || error.message)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-5" style={{background:'var(--bg)'}}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{background:'var(--bg2)',border:'1px solid rgba(249,115,22,.3)',boxShadow:'0 0 30px rgba(249,115,22,.08)'}}>
        <div className="text-center mb-7">
          <img src="/logo.png" alt="Industrial8" className="mx-auto mb-3" style={{height:'70px',width:'auto',objectFit:'contain'}} />
          <div className="text-xs tracking-widest" style={{color:'var(--t3)'}}>MANUTENÇÃO INDUSTRIAL INTELIGENTE</div>
        </div>
        {err && <div className="rounded-lg p-3 mb-3 text-xs" style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',color:'var(--rd)'}}>{err}</div>}
        <div className="mb-3">
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>E-mail</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&document.getElementById('pass')?.focus()}
            type="email" placeholder="seu@email.com" autoComplete="email"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
            style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
            onFocus={e=>{e.target.style.borderColor='var(--cy)'}} onBlur={e=>{e.target.style.borderColor='var(--bd)'}} />
        </div>
        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>Senha</label>
          <input id="pass" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}
            type="password" placeholder="••••••••" autoComplete="current-password"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
            style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
            onFocus={e=>{e.target.style.borderColor='var(--cy)'}} onBlur={e=>{e.target.style.borderColor='var(--bd)'}} />
        </div>
        <button onClick={login} disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all"
          style={{background:loading?'var(--s2)':'linear-gradient(135deg,#f97316,#ea6a00)',color:loading?'var(--t2)':'#fff',border:'none',cursor:loading?'not-allowed':'pointer',fontFamily:'Sora,system-ui,sans-serif'}}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <div className="text-center text-xs mt-4" style={{color:'var(--t3)'}}>Industrial8 · Acesso restrito</div>
      </div>
    </div>
  )
}
