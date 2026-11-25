'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLoginRateLimit } from '@/hooks/useRateLimit'

// Domínio interno usado para converter username -> email (invisível ao usuário)
const INTERNAL_DOMAIN = 'industrial8-internal.com'

export default function LoginPage({ onLogin }: { onLogin?: () => void }) {
  const [username, setUsername] = useState('')
  const [pass,  setPass]      = useState('')
  const [loading, setLoad]    = useState(false)
  const [err, setErr]         = useState('')
  const [showPass, setShow]   = useState(false)
  const { check, record, reset } = useLoginRateLimit()

  const now = new Date()
  const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const MTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const dateStr = `${DAYS[now.getDay()]}, ${now.getDate()} ${MTHS[now.getMonth()]} ${now.getFullYear()}`

  function usernameToEmail(u: string) {
    const v = u.trim().toLowerCase()
    // Se já contém @ (e-mail real, ex: usuários antigos), usa direto
    if (v.includes('@')) return v
    // Senão, converte username -> e-mail interno fictício
    const clean = v.replace(/[^a-z0-9._-]/g, '')
    return `${clean}@${INTERNAL_DOMAIN}`
  }

  async function login() {
    setErr('')

    const { allowed, remaining, waitMin } = check()
    if (!allowed) {
      setErr(`🔒 Muitas tentativas. Aguarde ${waitMin} min.`)
      return
    }

    if (!username || !pass) { setErr('Preencha usuário e senha.'); return }

    if (username.trim().length < 3) {
      setErr('Usuário deve ter ao menos 3 caracteres.')
      return
    }

    setLoad(true)
    const email = usernameToEmail(username)

    // 1) Verifica se a conta já está bloqueada permanentemente no banco
    const { data: bloqueio } = await supabase.rpc('fn_checar_bloqueio', { p_email: email })
    if (bloqueio?.blocked) {
      setErr('🔒 Conta bloqueada por tentativas incorretas. Contate o administrador.')
      setLoad(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })

    if (error) {
      record()
      // 2) Registra a tentativa falha no banco e bloqueia ao atingir 3
      const { data: tent } = await supabase.rpc('fn_registrar_tentativa_falha', { p_email: email })
      if (tent?.blocked) {
        setErr('🔒 Conta bloqueada após 3 tentativas incorretas. Contate o administrador.')
      } else if (tent?.found && typeof tent?.remaining === 'number') {
        setErr(`Usuário ou senha incorretos. (${tent.remaining} tentativa${tent.remaining===1?'':'s'} restante${tent.remaining===1?'':'s'})`)
      } else {
        const msgs: Record<string,string> = {
          'Invalid login credentials': 'Usuário ou senha incorretos.',
          'Too many requests':         '🔒 Bloqueado temporariamente pelo servidor. Aguarde.',
        }
        setErr(msgs[error.message] || error.message)
      }
      setLoad(false)
      return
    }

    // 3) Login OK — zera as tentativas do usuário
    reset()
    const { data: sess } = await supabase.auth.getUser()
    if (sess?.user?.id) {
      await supabase.rpc('fn_resetar_tentativas', { p_id: sess.user.id })
    }
    setLoad(false)
  }

  // caminho da engrenagem (reusado nas decorações de fundo)
  const COG = "M33 2h14l2 7a30 30 0 0 1 7 2.8l6.5-3.5 9.9 9.9-3.5 6.5A30 30 0 0 1 71.7 32l7 2v14l-7 2a30 30 0 0 1-2.8 7l3.5 6.5-9.9 9.9-6.5-3.5a30 30 0 0 1-7 2.8l-2 7h-14l-2-7a30 30 0 0 1-7-2.8l-6.5 3.5-9.9-9.9 3.5-6.5A30 30 0 0 1 8.3 46l-7-2V30l7-2a30 30 0 0 1 2.8-7L7.6 14.5l9.9-9.9 6.5 3.5a30 30 0 0 1 7-2.8L33 2z"
  const COG52 = "M22 1h8l1.5 5.5a18 18 0 0 1 4.5 1.8l5-2.8 5.7 5.7-2.8 5a18 18 0 0 1 1.8 4.5L51 22v8l-5.5 1.5a18 18 0 0 1-1.8 4.5l2.8 5-5.7 5.7-5-2.8a18 18 0 0 1-4.5 1.8L30 51h-8l-1.5-5.5a18 18 0 0 1-4.5-1.8l-5 2.8-5.7-5.7 2.8-5a18 18 0 0 1-1.8-4.5L1 30v-8l5.5-1.5a18 18 0 0 1 1.8-4.5l-2.8-5 5.7-5.7 5 2.8a18 18 0 0 1 4.5-1.8L22 1z"

  return (
    <>
      <style>{`
        @keyframes g-spin  { to { transform: rotate(360deg) } }
        @keyframes g-spinr { to { transform: rotate(-360deg) } }
        .g-inp:focus { border-color:var(--cy)!important; box-shadow:0 0 0 3px rgba(47,168,154,.15)!important; outline:none; background:#fff!important; }
        .g-btn:hover:not(:disabled) { box-shadow:0 8px 28px rgba(47,168,154,.4)!important; transform:translateY(-1px)!important; }
      `}</style>

      {/* Fundo claro industrial: brilhos, trama e engrenagens girando */}
      <div style={{position:'fixed',inset:0,overflow:'auto',fontFamily:"'Sora',system-ui,sans-serif",
        background:'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(47,168,154,.10), transparent 70%),radial-gradient(ellipse 50% 40% at 100% 100%, rgba(232,130,44,.07), transparent 70%),var(--bg)',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 16px'}}>

        {/* trama técnica sutil */}
        <div style={{position:'absolute',inset:0,pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(52,64,68,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(52,64,68,.045) 1px,transparent 1px)',
          backgroundSize:'46px 46px',
          WebkitMaskImage:'radial-gradient(ellipse 80% 80% at 50% 45%,#000,transparent 85%)',
          maskImage:'radial-gradient(ellipse 80% 80% at 50% 45%,#000,transparent 85%)'}}/>

        {/* engrenagens decorativas de fundo */}
        <svg width="260" height="260" viewBox="0 0 80 80" fill="var(--cy)" style={{position:'absolute',top:'-70px',left:'-60px',opacity:.09,pointerEvents:'none',transformOrigin:'center',animation:'g-spin 48s linear infinite'}}><path d={COG}/><circle cx="40" cy="40" r="13" fill="var(--bg)"/></svg>
        <svg width="320" height="320" viewBox="0 0 80 80" fill="var(--br)" style={{position:'absolute',bottom:'-90px',right:'-70px',opacity:.08,pointerEvents:'none',transformOrigin:'center',animation:'g-spinr 60s linear infinite'}}><path d={COG}/><circle cx="40" cy="40" r="13" fill="var(--bg)"/></svg>
        <svg width="150" height="150" viewBox="0 0 80 80" fill="var(--cy)" style={{position:'absolute',top:'14%',right:'8%',opacity:.09,pointerEvents:'none',transformOrigin:'center',animation:'g-spinr 40s linear infinite'}}><path d={COG}/><circle cx="40" cy="40" r="13" fill="var(--bg)"/></svg>
        <svg width="120" height="120" viewBox="0 0 80 80" fill="var(--cy)" style={{position:'absolute',bottom:'16%',left:'7%',opacity:.09,pointerEvents:'none',transformOrigin:'center',animation:'g-spin 54s linear infinite'}}><path d={COG}/><circle cx="40" cy="40" r="13" fill="var(--bg)"/></svg>

        {/* esteira industrial no rodapé */}
        <div style={{position:'absolute',left:0,right:0,bottom:'46px',height:'8px',opacity:.1,pointerEvents:'none',
          background:'repeating-linear-gradient(90deg,var(--t2) 0 14px,transparent 14px 28px)'}}/>

        {/* LOGO — duas engrenagens concêntricas girando em sentidos opostos */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'7px',marginBottom:'20px',position:'relative',zIndex:2}}>
          <div style={{display:'flex',alignItems:'center',gap:'13px'}}>
            <div style={{width:'52px',height:'52px',position:'relative',flexShrink:0}}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{position:'absolute',inset:0,transformOrigin:'center',animation:'g-spin 9s linear infinite'}}>
                <path d={COG52} fill="#fde3cf" stroke="#e8822c" strokeWidth="1.6"/>
              </svg>
              <svg width="24" height="24" viewBox="0 0 52 52" fill="none" style={{position:'absolute',top:'14px',left:'14px',transformOrigin:'center',animation:'g-spinr 6s linear infinite'}}>
                <path d={COG52} fill="#2fa89a"/>
              </svg>
              <div style={{position:'absolute',top:'50%',left:'50%',width:'7px',height:'7px',background:'#fff',border:'2px solid #2fa89a',borderRadius:'50%',transform:'translate(-50%,-50%)'}}/>
            </div>
            <div style={{fontSize:'32px',fontWeight:800,color:'var(--t1)',letterSpacing:'-.6px',lineHeight:1}}>
              industrial<span style={{color:'var(--br)'}}>8</span>
            </div>
          </div>
          <div style={{fontSize:'8.5px',letterSpacing:'3px',color:'var(--t3)',fontWeight:700,textTransform:'uppercase'}}>
            GERENCIAMENTO INDUSTRIAL INTELIGENTE
          </div>
        </div>

        {/* Data */}
        <div style={{fontSize:'10px',fontWeight:600,letterSpacing:'2px',color:'var(--t3)',background:'var(--s1)',
          padding:'4px 18px',borderRadius:'14px',border:'1px solid var(--bd)',whiteSpace:'nowrap',textTransform:'uppercase',marginBottom:'14px',
          position:'relative',zIndex:2,boxShadow:'var(--shadow)'}}>
          {dateStr}
        </div>

        {/* CARD — fixo, centralizado, sem animação */}
        <div style={{width:'min(360px,92vw)',background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:'22px',
          padding:'26px 26px 20px',position:'relative',zIndex:2,overflow:'hidden',boxShadow:'var(--shadow)'}}>
          {/* Linha de topo verde água */}
          <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,var(--cy),var(--cy2),var(--cy),transparent)'}}/>

          {/* Badge de segurança */}
          <div style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'center',marginBottom:'16px',padding:'6px 12px',
            background:'rgba(48,184,79,.08)',borderRadius:'8px',border:'1px solid rgba(48,184,79,.25)'}}>
            <span style={{fontSize:'11px'}}>🔐</span>
            <span style={{fontSize:'8px',color:'#2f8f4c',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase'}}>Acesso Seguro · Restrito à Empresa</span>
          </div>

          {err && (
            <div style={{background:'rgba(214,75,67,.08)',border:'1px solid rgba(214,75,67,.28)',borderRadius:'10px',padding:'8px 12px',marginBottom:'12px',fontSize:'11px',color:'var(--rd)',display:'flex',alignItems:'center',gap:'6px'}}>
              <span>⚠️</span> {err}
            </div>
          )}

          {/* Usuário */}
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'8px',fontWeight:700,letterSpacing:'1.5px',color:'var(--t3)',textTransform:'uppercase',marginBottom:'5px'}}>👤 USUÁRIO</div>
            <input className="g-inp" value={username} onChange={e=>setUsername(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&document.getElementById('gpw')?.focus()}
              type="text" placeholder="seu.usuario" autoComplete="username" spellCheck={false} autoCapitalize="none"
              style={{width:'100%',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'11px',padding:'11px 15px',color:'var(--t1)',fontFamily:"'Sora',system-ui",fontSize:'12px',transition:'all .2s',boxSizing:'border-box'}}/>
          </div>

          {/* Senha */}
          <div style={{marginBottom:'18px'}}>
            <div style={{fontSize:'8px',fontWeight:700,letterSpacing:'1.5px',color:'var(--t3)',textTransform:'uppercase',marginBottom:'5px'}}>🔒 SENHA</div>
            <div style={{position:'relative'}}>
              <input id="gpw" className="g-inp" value={pass} onChange={e=>setPass(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&login()}
                type={showPass?'text':'password'} placeholder="••••••••" autoComplete="current-password"
                style={{width:'100%',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'11px',padding:'11px 42px 11px 15px',color:'var(--t1)',fontFamily:"'Sora',system-ui",fontSize:'12px',transition:'all .2s',boxSizing:'border-box'}}/>
              <button onClick={()=>setShow(s=>!s)} tabIndex={-1}
                style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'14px',padding:'2px'}}>
                {showPass?'🙈':'👁️'}
              </button>
            </div>
          </div>

          {/* Botão */}
          <button className="g-btn" onClick={login} disabled={loading}
            style={{width:'100%',padding:'13px',border:'none',borderRadius:'13px',background:loading?'rgba(47,168,154,.2)':'linear-gradient(135deg,var(--cy),var(--cy2))',color:loading?'var(--t3)':'#fff',fontFamily:"'Sora',system-ui",fontSize:'12px',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',cursor:loading?'not-allowed':'pointer',boxShadow:loading?'none':'0 5px 20px rgba(47,168,154,.4)',transition:'all .2s',display:'block'}}>
            {loading?'⚙️ Autenticando...':'▶ ACESSAR SISTEMA'}
          </button>

          <div style={{textAlign:'center',marginTop:'12px',fontSize:'7px',color:'var(--t3)',letterSpacing:'2px'}}>
            🛡️ INDUSTRIAL8 · ACESSO RESTRITO · v1.0
          </div>
        </div>
      </div>
    </>
  )
}
