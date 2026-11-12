'use client'
// ═══════════════════════════════════════════════════════════════
// PAINEL DE CONTROLE DO SAAS — rota separada /admin
// Login próprio, só para SUPERADMIN. Gerencia as empresas cadastradas.
// Isolado do sistema das empresas (/app). Quem não for superadmin é barrado.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SuperAdminPage from '@/app/pages/SuperAdminPage'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

const INTERNAL_DOMAIN = 'industrial8-internal.com'
function usernameToEmail(u: string) {
  const v = (u||'').trim().toLowerCase()
  if (v.includes('@')) return v
  return `${v.replace(/[^a-z0-9._-]/g,'')}@${INTERNAL_DOMAIN}`
}

export default function AdminPanelPage() {
  const [profile, setProfile] = useState<UserProfile|null>(null)
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [load, setLoad] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) validarSuperadmin(data.session.user.id)
      else setChecking(false)
    })
  }, [])

  async function validarSuperadmin(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data && data.role === 'superadmin') {
      setProfile(data as any)
    } else {
      // logado mas não é superadmin → não pode usar este painel
      setProfile(null)
      setErr('Este acesso é exclusivo do administrador do sistema.')
    }
    setChecking(false)
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!username || !pass) { setErr('Preencha usuário e senha.'); return }
    setLoad(true)
    const email = usernameToEmail(username)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) {
      setErr(error.message === 'Invalid login credentials' ? 'Usuário ou senha incorretos.' : error.message)
      setLoad(false); return
    }
    // valida role
    const uid = data.user?.id
    if (uid) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
      if (prof && prof.role === 'superadmin') {
        setProfile(prof as any)
      } else {
        await supabase.auth.signOut()
        setErr('Este acesso é exclusivo do administrador do sistema.')
      }
    }
    setLoad(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    setProfile(null); setUsername(''); setPass('')
  }

  if (checking) {
    return <div style={sx.center}><div style={{color:'var(--t3)',fontSize:'13px'}}>Verificando acesso…</div></div>
  }

  // ── Autenticado como superadmin → painel ──
  if (profile) {
    return (
      <div style={{minHeight:'100vh',background:'var(--bg,#0a1322)'}}>
        <div style={sx.topbar}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'20px'}}>🛡️</span>
            <div>
              <div style={{fontSize:'14px',fontWeight:800,color:'#fff'}}>Painel de Controle — SaaS</div>
              <div style={{fontSize:'10px',color:'var(--t3,#5f7694)'}}>Gestão das empresas · {profile.display_name||'Administrador'}</div>
            </div>
          </div>
          <button onClick={sair} style={sx.logout}>Sair</button>
        </div>
        <div style={{padding:'16px',maxWidth:'1100px',margin:'0 auto'}}>
          <SuperAdminPage profile={profile} />
        </div>
      </div>
    )
  }

  // ── Login ──
  return (
    <div style={sx.center}>
      <form onSubmit={entrar} style={sx.card}>
        <div style={{textAlign:'center',marginBottom:'22px'}}>
          <div style={{fontSize:'36px',marginBottom:'8px'}}>🛡️</div>
          <div style={{fontSize:'18px',fontWeight:800,color:'#fff'}}>Painel de Controle</div>
          <div style={{fontSize:'11px',color:'var(--t3,#5f7694)',marginTop:'4px'}}>Administração do sistema (SaaS)</div>
        </div>
        <label style={sx.lbl}>Usuário</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="usuário master" autoComplete="username" style={sx.inp} />
        <label style={sx.lbl}>Senha</label>
        <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="••••••••" autoComplete="current-password" style={sx.inp} />
        {err && <div style={{color:'#f87171',fontSize:'12px',margin:'4px 0 10px'}}>{err}</div>}
        <button type="submit" disabled={load} style={{...sx.btn,opacity:load?.6:1,cursor:load?'wait':'pointer'}}>
          {load ? 'Entrando…' : 'Entrar'}
        </button>
        <div style={{textAlign:'center',marginTop:'16px'}}>
          <a href="/" style={{fontSize:'11px',color:'var(--t3,#5f7694)',textDecoration:'none'}}>← Ir para o sistema das empresas</a>
        </div>
      </form>
    </div>
  )
}

const sx: Record<string, React.CSSProperties> = {
  center: { minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',
    background:'radial-gradient(ellipse 90% 40% at 50% -5%,rgba(249,115,22,.08),transparent 60%),#0a1322' },
  card: { width:'100%',maxWidth:'360px',background:'#0e1b30',border:'1px solid rgba(148,163,184,.14)',
    borderRadius:'20px',padding:'28px 24px',boxShadow:'0 24px 60px -20px rgba(0,0,0,.7)' },
  lbl: { display:'block',fontSize:'10px',fontWeight:600,letterSpacing:'.4px',textTransform:'uppercase',color:'#9fb0c8',margin:'0 0 6px' },
  inp: { width:'100%',background:'#182a46',border:'1px solid rgba(148,163,184,.14)',borderRadius:'11px',
    padding:'11px 13px',color:'#eef2f8',fontFamily:"'Sora',system-ui",fontSize:'13px',outline:'none',marginBottom:'14px' },
  btn: { width:'100%',padding:'12px',borderRadius:'11px',border:'none',fontFamily:"'Sora',system-ui",
    fontSize:'13px',fontWeight:700,color:'#fff',background:'linear-gradient(135deg,#f97316,#c2410c)',
    boxShadow:'0 4px 14px -4px rgba(249,115,22,.6)' },
  topbar: { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',
    background:'#0e1b30',borderBottom:'1px solid rgba(148,163,184,.14)',position:'sticky',top:0,zIndex:10 },
  logout: { background:'rgba(239,68,68,.1)',color:'#f87171',border:'1px solid rgba(239,68,68,.3)',
    borderRadius:'10px',padding:'8px 16px',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:"'Sora',system-ui" },
}
