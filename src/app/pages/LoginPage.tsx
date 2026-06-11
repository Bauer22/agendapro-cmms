'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const now = new Date()
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`

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
    <div className="fixed inset-0 overflow-hidden" style={{background:'#0a1628'}}>

      {/* ── Industrial background ── */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          radial-gradient(ellipse 120% 80% at 50% 120%, rgba(249,115,22,.18) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 20% 50%, rgba(30,58,110,.4) 0%, transparent 50%),
          radial-gradient(ellipse 60% 40% at 80% 50%, rgba(30,58,110,.4) 0%, transparent 50%)
        `
      }}/>

      {/* Grid lines — blueprint effect */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `linear-gradient(rgba(249,115,22,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,.4) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }}/>

      {/* Animated gears background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large gear top-left */}
        <div className="absolute" style={{top:'-80px',left:'-80px',width:'300px',height:'300px',opacity:.06,animation:'spin 25s linear infinite'}}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M43.5 5h13l2 8a35 35 0 0 1 8.5 3.5l7-4.5 9.2 9.2-4.5 7A35 35 0 0 1 82 37.5l8 2v13l-8 2a35 35 0 0 1-3.5 8.5l4.5 7-9.2 9.2-7-4.5A35 35 0 0 1 58.5 77l-2 8h-13l-2-8a35 35 0 0 1-8.5-3.5l-7 4.5-9.2-9.2 4.5-7A35 35 0 0 1 18 52.5l-8-2v-13l8-2a35 35 0 0 1 3.5-8.5l-4.5-7 9.2-9.2 7 4.5A35 35 0 0 1 41.5 13l2-8z" fill="#f97316"/>
            <circle cx="50" cy="50" r="18" fill="#f97316"/>
            <circle cx="50" cy="50" r="8" fill="#0a1628"/>
          </svg>
        </div>
        {/* Large gear bottom-right */}
        <div className="absolute" style={{bottom:'-100px',right:'-100px',width:'400px',height:'400px',opacity:.06,animation:'spin 30s linear infinite reverse'}}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M43.5 5h13l2 8a35 35 0 0 1 8.5 3.5l7-4.5 9.2 9.2-4.5 7A35 35 0 0 1 82 37.5l8 2v13l-8 2a35 35 0 0 1-3.5 8.5l4.5 7-9.2 9.2-7-4.5A35 35 0 0 1 58.5 77l-2 8h-13l-2-8a35 35 0 0 1-8.5-3.5l-7 4.5-9.2-9.2 4.5-7A35 35 0 0 1 18 52.5l-8-2v-13l8-2a35 35 0 0 1 3.5-8.5l-4.5-7 9.2-9.2 7 4.5A35 35 0 0 1 41.5 13l2-8z" fill="#f97316"/>
            <circle cx="50" cy="50" r="18" fill="#f97316"/>
            <circle cx="50" cy="50" r="8" fill="#0a1628"/>
          </svg>
        </div>
        {/* Chain lines left */}
        <div className="absolute left-0 top-0 bottom-0 w-16 opacity-5" style={{
          backgroundImage: 'repeating-linear-gradient(180deg, #f97316 0px, #f97316 20px, transparent 20px, transparent 40px)',
          backgroundSize: '8px 40px'
        }}/>
        {/* Chain lines right */}
        <div className="absolute right-0 top-0 bottom-0 w-16 opacity-5" style={{
          backgroundImage: 'repeating-linear-gradient(180deg, #f97316 0px, #f97316 20px, transparent 20px, transparent 40px)',
          backgroundSize: '8px 40px'
        }}/>
        {/* Industrial pipes top */}
        <div className="absolute top-0 left-0 right-0 h-2 opacity-20" style={{background:'linear-gradient(90deg,transparent,#f97316,#1e3a6e,#f97316,transparent)'}}/>
        <div className="absolute bottom-0 left-0 right-0 h-2 opacity-20" style={{background:'linear-gradient(90deg,transparent,#f97316,#1e3a6e,#f97316,transparent)'}}/>
      </div>

      {/* ── Date top ── */}
      <div className="absolute top-6 left-0 right-0 text-center">
        <div className="text-xs tracking-widest font-semibold" style={{color:'rgba(249,115,22,.7)',letterSpacing:'4px',textTransform:'uppercase'}}>{dateStr}</div>
      </div>

      {/* ── Top logo ── */}
      <div className="absolute top-12 left-0 right-0 flex flex-col items-center">
        <img src="/logo.png" alt="Industrial8" style={{height:'48px',width:'auto',objectFit:'contain',filter:'drop-shadow(0 0 20px rgba(249,115,22,.5))'}} />
      </div>

      {/* ── Login card ── */}
      <div className="absolute inset-0 flex items-center justify-center px-5">
        <div className="w-full max-w-xs relative" style={{marginTop:'40px'}}>

          {/* Card glow effect */}
          <div className="absolute inset-0 rounded-2xl" style={{
            background:'rgba(249,115,22,.08)',
            boxShadow:'0 0 60px rgba(249,115,22,.15), 0 0 120px rgba(249,115,22,.06)',
            filter:'blur(1px)'
          }}/>

          {/* Card */}
          <div className="relative rounded-2xl overflow-hidden" style={{
            background:'rgba(14,24,45,.92)',
            border:'1px solid rgba(249,115,22,.35)',
            backdropFilter:'blur(20px)',
            boxShadow:'0 0 40px rgba(249,115,22,.12), inset 0 1px 0 rgba(249,115,22,.15)'
          }}>
            {/* Orange top bar */}
            <div style={{height:'3px',background:'linear-gradient(90deg,transparent,#f97316,#fb923c,#f97316,transparent)'}}/>

            <div className="p-7">
              {/* Logo inside card */}
              <div className="text-center mb-6">
                <img src="/logo.png" alt="Industrial8" className="mx-auto mb-2" style={{
                  height:'56px',width:'auto',objectFit:'contain',
                  filter:'drop-shadow(0 0 12px rgba(249,115,22,.6))'
                }} />
                <div style={{fontSize:'9px',letterSpacing:'3px',color:'rgba(249,115,22,.6)',textTransform:'uppercase',fontWeight:700}}>
                  MANUTENÇÃO INDUSTRIAL INTELIGENTE
                </div>
              </div>

              {err && (
                <div className="rounded-xl p-3 mb-4 text-xs" style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',color:'#ef4444'}}>
                  {err}
                </div>
              )}

              <div className="mb-4">
                <label className="block mb-1.5" style={{fontSize:'10px',fontWeight:700,letterSpacing:'1.5px',color:'rgba(249,115,22,.7)',textTransform:'uppercase'}}>✉ E-mail</label>
                <input value={email} onChange={e=>setEmail(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&document.getElementById('pass')?.focus()}
                  type="email" placeholder="seu@email.com" autoComplete="email"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background:'rgba(249,115,22,.06)',
                    border:'1px solid rgba(249,115,22,.2)',
                    color:'#e8edf5',
                    fontFamily:'Sora,system-ui,sans-serif'
                  }}
                  onFocus={e=>{e.target.style.borderColor='rgba(249,115,22,.6)';e.target.style.boxShadow='0 0 12px rgba(249,115,22,.15)'}}
                  onBlur={e=>{e.target.style.borderColor='rgba(249,115,22,.2)';e.target.style.boxShadow='none'}} />
              </div>

              <div className="mb-6">
                <label className="block mb-1.5" style={{fontSize:'10px',fontWeight:700,letterSpacing:'1.5px',color:'rgba(249,115,22,.7)',textTransform:'uppercase'}}>🔒 Senha</label>
                <input id="pass" value={pass} onChange={e=>setPass(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&login()}
                  type="password" placeholder="••••••••" autoComplete="current-password"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background:'rgba(249,115,22,.06)',
                    border:'1px solid rgba(249,115,22,.2)',
                    color:'#e8edf5',
                    fontFamily:'Sora,system-ui,sans-serif'
                  }}
                  onFocus={e=>{e.target.style.borderColor='rgba(249,115,22,.6)';e.target.style.boxShadow='0 0 12px rgba(249,115,22,.15)'}}
                  onBlur={e=>{e.target.style.borderColor='rgba(249,115,22,.2)';e.target.style.boxShadow='none'}} />
              </div>

              <button onClick={login} disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all relative overflow-hidden"
                style={{
                  background: loading ? 'rgba(249,115,22,.2)' : 'linear-gradient(135deg,#f97316,#ea6a00)',
                  color: loading ? 'rgba(249,115,22,.5)' : '#fff',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Sora,system-ui,sans-serif',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(249,115,22,.4)',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontSize: '12px',
                }}>
                {loading ? '⚙️ Autenticando...' : '▶ ACESSAR SISTEMA'}
              </button>

              <div className="text-center mt-4" style={{fontSize:'9px',color:'rgba(255,255,255,.2)',letterSpacing:'1px'}}>
                INDUSTRIAL8 · ACESSO RESTRITO
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{height:'2px',background:'linear-gradient(90deg,transparent,rgba(249,115,22,.4),transparent)'}}/>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
