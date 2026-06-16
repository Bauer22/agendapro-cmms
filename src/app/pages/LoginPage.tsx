'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLoginRateLimit } from '@/hooks/useRateLimit'

// Domínio interno usado para converter username -> email (invisível ao usuário)
const INTERNAL_DOMAIN = 'industrial8.local'

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
    const clean = u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
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

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })

    if (error) {
      record()
      const msgs: Record<string,string> = {
        'Invalid login credentials': `Usuário ou senha incorretos. (${remaining - 1} tentativas restantes)`,
        'Too many requests':         '🔒 Bloqueado temporariamente pelo servidor. Aguarde.',
      }
      setErr(msgs[error.message] || error.message)
      setLoad(false)
      return
    }

    reset()
    setLoad(false)
  }

  return (
    <>
      <style>{`
        @keyframes g-spin  { to { transform: rotate(360deg) } }
        @keyframes g-float { 0%,100%{transform:translate(-50%,-46%)} 50%{transform:translate(-50%,-50%)} }
        @keyframes g-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes g-glow  { 0%,100%{opacity:.3;transform:translateX(-50%) scale(1)} 50%{opacity:.65;transform:translateX(-50%) scale(1.1)} }
        .g-inp:focus { border-color:rgba(249,115,22,.65)!important; box-shadow:0 0 16px rgba(249,115,22,.18)!important; outline:none; }
        .g-btn:hover:not(:disabled) { box-shadow:0 8px 32px rgba(249,115,22,.7)!important; transform:translateY(-2px)!important; }
      `}</style>

      <div style={{position:'fixed',inset:0,overflow:'hidden',fontFamily:"'Sora',system-ui,sans-serif"}}>

        {/* Base */}
        <div style={{position:'absolute',inset:0,background:'#06101e'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 130% 65% at 50% 110%,rgba(16,28,14,.95),transparent),radial-gradient(ellipse 55% 80% at 8% 50%,rgba(5,12,24,.92),transparent),radial-gradient(ellipse 55% 80% at 92% 50%,rgba(5,12,24,.92),transparent)'}}/>
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(249,115,22,.026) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,.026) 1px,transparent 1px)',backgroundSize:'50px 50px',animation:'g-pulse 6s ease-in-out infinite'}}/>
        <div style={{position:'absolute',top:'18%',left:'50%',width:'58vw',height:'40vh',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(249,115,22,.09),transparent 68%)',animation:'g-glow 4s ease-in-out infinite',pointerEvents:'none'}}/>

        {/* Beams */}
        <div style={{position:'absolute',top:0,left:0,right:0,height:'6px',background:'linear-gradient(180deg,#1e2e40,#0e1e30)'}}/>
        <div style={{position:'absolute',top:'6px',left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,rgba(249,115,22,.5),rgba(249,115,22,.8),rgba(249,115,22,.5),transparent)',animation:'g-pulse 3s ease-in-out infinite'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:'6px',background:'linear-gradient(0deg,#1e2e40,#0e1e30)'}}/>

        {/* LEFT WALL */}
        <div style={{position:'absolute',left:0,top:0,bottom:0,width:'24%',background:'linear-gradient(90deg,rgba(6,14,26,.96),rgba(10,20,36,.7),transparent)'}}>
          <div style={{position:'absolute',left:'14%',top:'12%',width:'14px',height:'65%',background:'linear-gradient(90deg,#182636,#283848,#3a4858,#283848,#182636)',borderRadius:'7px'}}/>
          <div style={{position:'absolute',left:'30%',top:'6%',width:'10px',height:'76%',background:'linear-gradient(90deg,#121e2c,#202e3c,#121e2c)',borderRadius:'5px'}}/>
          <div style={{position:'absolute',left:0,top:'36%',width:'92%',height:'12px',background:'linear-gradient(180deg,#223244,#162838,#223244)',borderRadius:'0 5px 5px 0'}}/>
          <div style={{position:'absolute',left:0,top:'57%',width:'70%',height:'9px',background:'linear-gradient(180deg,#1c2c3e,#102030,#1c2c3e)',borderRadius:'0 4px 4px 0'}}/>
          {[['12%','28%'],['12%','50%'],['27%','41%'],['12%','66%']].map(([l,t],i)=>(
            <div key={i} style={{position:'absolute',left:l,top:t,width:'20px',height:'28px',background:'linear-gradient(180deg,#2c3e50,#1c2e40)',borderRadius:'3px',border:'1px solid rgba(255,255,255,.09)'}}/>
          ))}
          <div style={{position:'absolute',left:'14%',top:'38%',width:'14px',height:'14%',background:'rgba(249,115,22,.2)',boxShadow:'0 0 16px rgba(249,115,22,.6)',borderRadius:'6px',animation:'g-pulse 2.5s ease-in-out infinite'}}/>
          <div style={{position:'absolute',left:0,top:'37%',width:'58%',height:'3px',background:'rgba(249,115,22,.25)',boxShadow:'0 0 10px rgba(249,115,22,.5)',animation:'g-pulse 2s ease-in-out infinite .5s'}}/>
          <div style={{position:'absolute',left:'5%',top:'18%',width:'9px',height:'38%',backgroundImage:'repeating-linear-gradient(180deg,#4a5c6e 0,#4a5c6e 8px,#283848 8px,#283848 16px)',borderRadius:'4px',opacity:.18}}/>
          <div style={{position:'absolute',left:'40%',top:'13%',width:'5px',height:'27%',background:'linear-gradient(90deg,#182636,#283848)',borderRadius:'4px',transform:'rotate(-13deg)',transformOrigin:'top center'}}/>
          <div style={{position:'absolute',left:'32%',top:'38%',width:'56px',height:'6px',background:'linear-gradient(180deg,#283848,#384858)',borderRadius:'3px',transform:'rotate(-5deg)'}}/>
          <div style={{position:'absolute',left:'32%',top:'38%',width:'11px',height:'11px',borderRadius:'50%',background:'#384858',border:'2px solid #f97316',transform:'translate(-3px,-2px)',boxShadow:'0 0 7px rgba(249,115,22,.45)'}}/>
          <div style={{position:'absolute',left:'4%',top:'4%',width:'74%',height:'25%',background:'rgba(0,14,38,.88)',border:'1px solid rgba(0,90,200,.2)',borderRadius:'7px',overflow:'hidden',opacity:.72}}>
            <div style={{position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,rgba(0,110,255,.07) 0,rgba(0,110,255,.07) 1px,transparent 1px,transparent 10px),repeating-linear-gradient(90deg,rgba(0,110,255,.07) 0,rgba(0,110,255,.07) 1px,transparent 1px,transparent 10px)'}}/>
            <div style={{position:'absolute',top:'8px',left:'8px',width:'20px',height:'20px',borderRadius:'50%',border:'1.5px solid rgba(0,180,255,.4)'}}/>
            <div style={{position:'absolute',bottom:'8px',left:'6px',right:'6px',display:'flex',flexDirection:'column',gap:'3px'}}>
              {['72%','48%','82%','40%'].map((w,i)=><div key={i} style={{height:'2px',background:'rgba(0,180,255,.32)',borderRadius:'1px',width:w}}/>)}
            </div>
          </div>
          <div style={{position:'absolute',left:'-14%',top:'54%',opacity:.13}}>
            <svg width="120" height="120" viewBox="0 0 80 80" fill="none">
              <g style={{transformOrigin:'40px 39px',animation:'g-spin 15s linear infinite reverse'}}>
                <path d="M33 2h14l2 7a30 30 0 0 1 7 2.8l6.5-3.5 9.9 9.9-3.5 6.5A30 30 0 0 1 71.7 32l7 2v14l-7 2a30 30 0 0 1-2.8 7l3.5 6.5-9.9 9.9-6.5-3.5a30 30 0 0 1-7 2.8l-2 7h-14l-2-7a30 30 0 0 1-7-2.8l-6.5 3.5-9.9-9.9 3.5-6.5A30 30 0 0 1 8.3 46l-7-2V30l7-2a30 30 0 0 1 2.8-7L7.6 14.5l9.9-9.9 6.5 3.5a30 30 0 0 1 7-2.8L33 2z" fill="#3a5878"/>
                <circle cx="40" cy="39" r="14" fill="#06101e"/>
              </g>
            </svg>
          </div>
        </div>

        {/* RIGHT WALL */}
        <div style={{position:'absolute',right:0,top:0,bottom:0,width:'24%',background:'linear-gradient(-90deg,rgba(6,14,26,.96),rgba(10,20,36,.7),transparent)'}}>
          <div style={{position:'absolute',right:'14%',top:'7%',width:'14px',height:'70%',background:'linear-gradient(90deg,#182636,#283848,#3a4858,#283848,#182636)',borderRadius:'7px'}}/>
          <div style={{position:'absolute',right:'30%',top:'14%',width:'10px',height:'62%',background:'linear-gradient(90deg,#121e2c,#202e3c,#121e2c)',borderRadius:'5px'}}/>
          <div style={{position:'absolute',right:0,top:'41%',width:'90%',height:'12px',background:'linear-gradient(180deg,#223244,#162838,#223244)',borderRadius:'5px 0 0 5px'}}/>
          <div style={{position:'absolute',right:0,top:'62%',width:'65%',height:'9px',background:'linear-gradient(180deg,#1c2c3e,#102030,#1c2c3e)',borderRadius:'4px 0 0 4px'}}/>
          {[['12%','25%'],['12%','47%'],['27%','38%'],['12%','66%']].map(([r,t],i)=>(
            <div key={i} style={{position:'absolute',right:r,top:t,width:'20px',height:'28px',background:'linear-gradient(180deg,#2c3e50,#1c2e40)',borderRadius:'3px',border:'1px solid rgba(255,255,255,.09)'}}/>
          ))}
          <div style={{position:'absolute',right:'14%',top:'44%',width:'14px',height:'13%',background:'rgba(249,115,22,.18)',boxShadow:'0 0 16px rgba(249,115,22,.55)',borderRadius:'6px',animation:'g-pulse 2.5s ease-in-out infinite .8s'}}/>
          <div style={{position:'absolute',right:0,top:'42%',width:'54%',height:'3px',background:'rgba(249,115,22,.22)',boxShadow:'0 0 10px rgba(249,115,22,.48)',animation:'g-pulse 2s ease-in-out infinite 1.3s'}}/>
          <div style={{position:'absolute',right:'5%',top:'16%',width:'9px',height:'40%',backgroundImage:'repeating-linear-gradient(180deg,#4a5c6e 0,#4a5c6e 8px,#283848 8px,#283848 16px)',borderRadius:'4px',opacity:.18}}/>
          <div style={{position:'absolute',right:'40%',top:'11%',width:'5px',height:'28%',background:'linear-gradient(90deg,#182636,#283848)',borderRadius:'4px',transform:'rotate(12deg)',transformOrigin:'top center'}}/>
          <div style={{position:'absolute',right:'29%',top:'37%',width:'56px',height:'6px',background:'linear-gradient(180deg,#283848,#384858)',borderRadius:'3px',transform:'rotate(5deg)'}}/>
          <div style={{position:'absolute',right:'29%',top:'37%',width:'11px',height:'11px',borderRadius:'50%',background:'#384858',border:'2px solid #f97316',transform:'translate(3px,-2px)',boxShadow:'0 0 7px rgba(249,115,22,.45)'}}/>
          <div style={{position:'absolute',right:'4%',top:'3%',width:'74%',height:'23%',background:'rgba(0,14,38,.88)',border:'1px solid rgba(0,90,200,.2)',borderRadius:'7px',overflow:'hidden',opacity:.68}}>
            <div style={{position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,rgba(0,110,255,.07) 0,rgba(0,110,255,.07) 1px,transparent 1px,transparent 10px),repeating-linear-gradient(90deg,rgba(0,110,255,.07) 0,rgba(0,110,255,.07) 1px,transparent 1px,transparent 10px)'}}/>
            <div style={{position:'absolute',bottom:'7px',left:'6px',right:'6px',display:'flex',flexDirection:'column',gap:'3px'}}>
              {['58%','78%','44%'].map((w,i)=><div key={i} style={{height:'2px',background:'rgba(0,180,255,.3)',borderRadius:'1px',width:w}}/>)}
            </div>
          </div>
          <div style={{position:'absolute',right:'-14%',top:'47%',opacity:.12}}>
            <svg width="130" height="130" viewBox="0 0 80 80" fill="none">
              <g style={{transformOrigin:'40px 39px',animation:'g-spin 18s linear infinite'}}>
                <path d="M33 2h14l2 7a30 30 0 0 1 7 2.8l6.5-3.5 9.9 9.9-3.5 6.5A30 30 0 0 1 71.7 32l7 2v14l-7 2a30 30 0 0 1-2.8 7l3.5 6.5-9.9 9.9-6.5-3.5a30 30 0 0 1-7 2.8l-2 7h-14l-2-7a30 30 0 0 1-7-2.8l-6.5 3.5-9.9-9.9 3.5-6.5A30 30 0 0 1 8.3 46l-7-2V30l7-2a30 30 0 0 1 2.8-7L7.6 14.5l9.9-9.9 6.5 3.5a30 30 0 0 1 7-2.8L33 2z" fill="#284868"/>
                <circle cx="40" cy="39" r="14" fill="#06101e"/>
              </g>
            </svg>
          </div>
        </div>

        {/* Top chain */}
        <div style={{position:'absolute',top:'4%',left:'22%',width:'56%',height:'9px',backgroundImage:'repeating-linear-gradient(90deg,#485a6c 0,#485a6c 8px,#283848 8px,#283848 16px)',borderRadius:'4px',opacity:.15}}/>

        {/* TOP LOGO */}
        <div style={{position:'absolute',top:'5%',left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'5px',zIndex:5,filter:'drop-shadow(0 0 22px rgba(249,115,22,.5))'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <svg width="54" height="54" viewBox="0 0 52 52" fill="none">
              <g style={{transformOrigin:'26px 26px',animation:'g-spin 8s linear infinite'}}>
                <path d="M22 1h8l1.5 5.5a18 18 0 0 1 4.5 1.8l5-2.8 5.7 5.7-2.8 5a18 18 0 0 1 1.8 4.5L51 22v8l-5.5 1.5a18 18 0 0 1-1.8 4.5l2.8 5-5.7 5.7-5-2.8a18 18 0 0 1-4.5 1.8L30 51h-8l-1.5-5.5a18 18 0 0 1-4.5-1.8l-5 2.8-5.7-5.7 2.8-5a18 18 0 0 1-1.8-4.5L1 30v-8l5.5-1.5a18 18 0 0 1 1.8-4.5l-2.8-5 5.7-5.7 5 2.8a18 18 0 0 1 4.5-1.8L22 1z" fill="#1e3a6e" stroke="#f97316" strokeWidth="1.3"/>
              </g>
              <circle cx="26" cy="26" r="9" fill="#06101e" stroke="#f97316" strokeWidth="1.5"/>
              <g style={{transformOrigin:'26px 26px',animation:'g-spin 5s linear infinite reverse'}}>
                <circle cx="26" cy="26" r="5.5" fill="none" stroke="rgba(249,115,22,.45)" strokeWidth="1" strokeDasharray="3 2"/>
              </g>
              <circle cx="26" cy="26" r="2.8" fill="#f97316"/>
              <circle cx="26" cy="26" r="1.1" fill="#06101e"/>
            </svg>
            <div style={{fontSize:'32px',fontWeight:800,color:'#e8edf5',letterSpacing:'-.6px',lineHeight:1,fontFamily:"'Sora',system-ui"}}>
              industrial<span style={{color:'#f97316'}}>8</span>
            </div>
          </div>
          <div style={{fontSize:'8.5px',letterSpacing:'3.5px',color:'rgba(249,115,22,.55)',fontWeight:700,textTransform:'uppercase'}}>
            MANUTENÇÃO INDUSTRIAL INTELIGENTE
          </div>
        </div>

        {/* Date */}
        <div style={{position:'absolute',top:'27%',left:'50%',transform:'translateX(-50%)',fontSize:'10px',fontWeight:600,letterSpacing:'2.5px',color:'rgba(200,220,240,.6)',background:'rgba(0,0,0,.4)',padding:'4px 20px',borderRadius:'14px',border:'1px solid rgba(255,255,255,.07)',zIndex:5,whiteSpace:'nowrap',textTransform:'uppercase'}}>
          {dateStr}
        </div>

        {/* FLOATING CARD */}
        <div style={{position:'absolute',top:'50%',left:'50%',zIndex:20,width:'min(318px,82vw)',animation:'g-float 5s ease-in-out infinite'}}>
          <div style={{position:'absolute',bottom:'-14px',left:'-22px',right:'-22px',height:'18px',borderRadius:'10px',background:'linear-gradient(180deg,rgba(200,220,240,.1),rgba(100,150,200,.04))',border:'1px solid rgba(200,220,240,.1)',filter:'blur(1px)'}}/>
          <div style={{position:'absolute',inset:'-3px',borderRadius:'23px',background:'linear-gradient(135deg,rgba(249,115,22,.18),transparent 50%,rgba(249,115,22,.08))',filter:'blur(5px)',zIndex:-1}}/>

          <div style={{background:'rgba(8,16,32,.94)',border:'1px solid rgba(249,115,22,.32)',borderRadius:'20px',padding:'28px 28px 22px',position:'relative',overflow:'hidden',boxShadow:'0 0 80px rgba(249,115,22,.15),0 30px 80px rgba(0,0,0,.75),inset 0 1px 0 rgba(249,115,22,.2)',backdropFilter:'blur(28px)'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,#f97316,#fb923c,#f97316,transparent)',boxShadow:'0 0 10px rgba(249,115,22,.6)'}}/>
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(249,115,22,.22),transparent)'}}/>
            {['left','right'].map((s,i)=>(
              <div key={i} style={{position:'absolute',[s]:'-6px',top:'15%',bottom:'15%',width:'8px',backgroundImage:'repeating-linear-gradient(180deg,#505a6c 0,#505a6c 7px,#303848 7px,#303848 14px)',borderRadius:'4px',opacity:.48}}/>
            ))}

            {/* Card Logo */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:'20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'9px',filter:'drop-shadow(0 0 12px rgba(249,115,22,.6))'}}>
                <svg width="40" height="40" viewBox="0 0 52 52" fill="none">
                  <g style={{transformOrigin:'26px 26px',animation:'g-spin 6s linear infinite'}}>
                    <path d="M22 1h8l1.5 5.5a18 18 0 0 1 4.5 1.8l5-2.8 5.7 5.7-2.8 5a18 18 0 0 1 1.8 4.5L51 22v8l-5.5 1.5a18 18 0 0 1-1.8 4.5l2.8 5-5.7 5.7-5-2.8a18 18 0 0 1-4.5 1.8L30 51h-8l-1.5-5.5a18 18 0 0 1-4.5-1.8l-5 2.8-5.7-5.7 2.8-5a18 18 0 0 1-1.8-4.5L1 30v-8l5.5-1.5a18 18 0 0 1 1.8-4.5l-2.8-5 5.7-5.7 5 2.8a18 18 0 0 1 4.5-1.8L22 1z" fill="#1e3a6e" stroke="#f97316" strokeWidth="1.2"/>
                  </g>
                  <circle cx="26" cy="26" r="9" fill="#08101e" stroke="#f97316" strokeWidth="1.5"/>
                  <g style={{transformOrigin:'26px 26px',animation:'g-spin 4s linear infinite reverse'}}>
                    <circle cx="26" cy="26" r="5.5" fill="none" stroke="rgba(249,115,22,.4)" strokeWidth="1" strokeDasharray="3 2"/>
                  </g>
                  <circle cx="26" cy="26" r="2.8" fill="#f97316"/>
                  <circle cx="26" cy="26" r="1.1" fill="#08101e"/>
                </svg>
                <div style={{fontSize:'22px',fontWeight:800,color:'#e8edf5',letterSpacing:'-.4px',lineHeight:1}}>
                  industrial<span style={{color:'#f97316'}}>8</span>
                </div>
              </div>
              <div style={{fontSize:'7px',letterSpacing:'2.5px',color:'rgba(249,115,22,.5)',marginTop:'4px',fontWeight:700,textTransform:'uppercase'}}>
                MANUTENÇÃO INDUSTRIAL INTELIGENTE
              </div>
            </div>

            {/* Security badge */}
            <div style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'center',marginBottom:'16px',padding:'5px 12px',background:'rgba(34,197,94,.06)',borderRadius:'8px',border:'1px solid rgba(34,197,94,.2)'}}>
              <span style={{fontSize:'11px'}}>🔐</span>
              <span style={{fontSize:'8px',color:'rgba(34,197,94,.7)',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase'}}>Acesso Seguro · Restrito à Empresa</span>
            </div>

            {err && (
              <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.28)',borderRadius:'10px',padding:'8px 12px',marginBottom:'12px',fontSize:'11px',color:'#ef4444',display:'flex',alignItems:'center',gap:'6px'}}>
                <span>⚠️</span> {err}
              </div>
            )}

            {/* Username */}
            <div style={{marginBottom:'12px'}}>
              <div style={{fontSize:'8px',fontWeight:700,letterSpacing:'1.5px',color:'rgba(249,115,22,.65)',textTransform:'uppercase',marginBottom:'5px'}}>👤 USUÁRIO</div>
              <input className="g-inp" value={username} onChange={e=>setUsername(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&document.getElementById('gpw')?.focus()}
                type="text" placeholder="seu.usuario" autoComplete="username" spellCheck={false} autoCapitalize="none"
                style={{width:'100%',background:'rgba(249,115,22,.04)',border:'1px solid rgba(249,115,22,.18)',borderRadius:'11px',padding:'11px 15px',color:'#e8edf5',fontFamily:"'Sora',system-ui",fontSize:'12px',transition:'all .2s',boxSizing:'border-box'}}/>
            </div>

            {/* Password */}
            <div style={{marginBottom:'18px'}}>
              <div style={{fontSize:'8px',fontWeight:700,letterSpacing:'1.5px',color:'rgba(249,115,22,.65)',textTransform:'uppercase',marginBottom:'5px'}}>🔒 SENHA</div>
              <div style={{position:'relative'}}>
                <input id="gpw" className="g-inp" value={pass} onChange={e=>setPass(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&login()}
                  type={showPass?'text':'password'} placeholder="••••••••" autoComplete="current-password"
                  style={{width:'100%',background:'rgba(249,115,22,.04)',border:'1px solid rgba(249,115,22,.18)',borderRadius:'11px',padding:'11px 42px 11px 15px',color:'#e8edf5',fontFamily:"'Sora',system-ui",fontSize:'12px',transition:'all .2s',boxSizing:'border-box'}}/>
                <button onClick={()=>setShow(s=>!s)} tabIndex={-1}
                  style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'rgba(249,115,22,.5)',cursor:'pointer',fontSize:'14px',padding:'2px'}}>
                  {showPass?'🙈':'👁️'}
                </button>
              </div>
            </div>

            {/* Button */}
            <button className="g-btn" onClick={login} disabled={loading}
              style={{width:'100%',padding:'13px',border:'none',borderRadius:'13px',background:loading?'rgba(249,115,22,.15)':'linear-gradient(135deg,#f97316,#c85a00)',color:loading?'rgba(249,115,22,.4)':'#fff',fontFamily:"'Sora',system-ui",fontSize:'12px',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',cursor:loading?'not-allowed':'pointer',boxShadow:loading?'none':'0 5px 24px rgba(249,115,22,.5)',transition:'all .2s',display:'block'}}>
              {loading?'⚙️ Autenticando...':'▶ ACESSAR SISTEMA'}
            </button>

            <div style={{textAlign:'center',marginTop:'12px',fontSize:'7px',color:'rgba(255,255,255,.12)',letterSpacing:'2px'}}>
              🛡️ INDUSTRIAL8 · ACESSO RESTRITO · v1.0
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
