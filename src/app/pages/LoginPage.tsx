'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage({ onLogin }: { onLogin?: () => void }) {
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

  // Gear SVG component
  const Gear = ({ size, speed, reverse, opacity, color }: any) => (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" style={{display:'block'}}>
      <g style={{transformOrigin:'40px 39px', animation:`i8spin ${speed}s linear infinite${reverse?' reverse':''}`}}>
        <path d="M33 2h14l2 7a30 30 0 0 1 7 2.8l6.5-3.5 9.9 9.9-3.5 6.5A30 30 0 0 1 71.7 32l7 2v14l-7 2a30 30 0 0 1-2.8 7l3.5 6.5-9.9 9.9-6.5-3.5a30 30 0 0 1-7 2.8l-2 7h-14l-2-7a30 30 0 0 1-7-2.8l-6.5 3.5-9.9-9.9 3.5-6.5A30 30 0 0 1 8.3 46l-7-2V30l7-2a30 30 0 0 1 2.8-7L7.6 14.5l9.9-9.9 6.5 3.5a30 30 0 0 1 7-2.8L33 2z" fill={color||'#3a5a7a'}/>
        <circle cx="40" cy="39" r="14" fill="#07101e"/>
      </g>
    </svg>
  )

  const LogoGear = ({ size }: any) => (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      <g style={{transformOrigin:'26px 26px', animation:'i8spin 7s linear infinite'}}>
        <path d="M22 1h8l1.5 5.5a18 18 0 0 1 4.5 1.8l5-2.8 5.7 5.7-2.8 5a18 18 0 0 1 1.8 4.5L51 22v8l-5.5 1.5a18 18 0 0 1-1.8 4.5l2.8 5-5.7 5.7-5-2.8a18 18 0 0 1-4.5 1.8L30 51h-8l-1.5-5.5a18 18 0 0 1-4.5-1.8l-5 2.8-5.7-5.7 2.8-5a18 18 0 0 1-1.8-4.5L1 30v-8l5.5-1.5a18 18 0 0 1 1.8-4.5l-2.8-5 5.7-5.7 5 2.8a18 18 0 0 1 4.5-1.8L22 1z" fill="#1e3a6e" stroke="#f97316" strokeWidth="1.2"/>
      </g>
      <circle cx="26" cy="26" r="9" fill="#07101e" stroke="#f97316" strokeWidth="1.5"/>
      <g style={{transformOrigin:'26px 26px', animation:'i8spin 4s linear infinite reverse'}}>
        <circle cx="26" cy="26" r="5.5" fill="none" stroke="rgba(249,115,22,.4)" strokeWidth="1" strokeDasharray="3 2"/>
      </g>
      <circle cx="26" cy="26" r="2.8" fill="#f97316"/>
      <circle cx="26" cy="26" r="1.1" fill="#07101e"/>
    </svg>
  )

  return (
    <>
      <style>{`
        @keyframes i8spin  { to { transform: rotate(360deg) } }
        @keyframes i8pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes i8float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes i8glow  { 0%,100%{opacity:.35;transform:translateX(-50%) scale(1)} 50%{opacity:.7;transform:translateX(-50%) scale(1.08)} }
        @keyframes i8bar   { 0%,100%{opacity:.6} 50%{opacity:1} }
        .i8inp:focus { border-color:rgba(249,115,22,.6)!important; box-shadow:0 0 14px rgba(249,115,22,.15)!important; outline:none; }
        .i8btn:hover { box-shadow:0 8px 32px rgba(249,115,22,.7)!important; transform:translateY(-2px)!important; }
        .i8btn:active { transform:translateY(0)!important; }
      `}</style>

      <div style={{position:'fixed',inset:0,overflow:'hidden',fontFamily:"'Sora',system-ui,sans-serif",userSelect:'none'}}>

        {/* ─── BASE BACKGROUND ─── */}
        <div style={{position:'absolute',inset:0,background:'#07101e'}}/>

        {/* Atmosphere gradient */}
        <div style={{position:'absolute',inset:0,background:`
          radial-gradient(ellipse 120% 60% at 50% 110%, rgba(18,32,15,.95), transparent),
          radial-gradient(ellipse 55% 70% at 10% 50%, rgba(6,14,28,.9), transparent),
          radial-gradient(ellipse 55% 70% at 90% 50%, rgba(6,14,28,.9), transparent)
        `}}/>

        {/* Blueprint grid */}
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(249,115,22,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,.028) 1px,transparent 1px)',backgroundSize:'50px 50px',animation:'i8pulse 6s ease-in-out infinite'}}/>

        {/* Center orange glow */}
        <div style={{position:'absolute',top:'18%',left:'50%',width:'60vw',height:'40vh',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(249,115,22,.09),transparent 68%)',animation:'i8glow 4s ease-in-out infinite',pointerEvents:'none'}}/>

        {/* ─── TOP & BOTTOM BEAMS ─── */}
        <div style={{position:'absolute',top:0,left:0,right:0,height:'6px',background:'linear-gradient(180deg,#1e2e40,#0e1e30)'}}/>
        <div style={{position:'absolute',top:'6px',left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,rgba(249,115,22,.3),rgba(249,115,22,.6),rgba(249,115,22,.3),transparent)',animation:'i8bar 3s ease-in-out infinite'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:'6px',background:'linear-gradient(0deg,#1e2e40,#0e1e30)'}}/>

        {/* ─── LEFT WALL ─── */}
        <div style={{position:'absolute',left:0,top:0,bottom:0,width:'22%',background:'linear-gradient(90deg,rgba(8,16,28,.95),rgba(12,22,38,.6),transparent)'}}>
          {/* Main vertical pipe L1 */}
          <div style={{position:'absolute',left:'12%',top:'12%',width:'14px',height:'65%',background:'linear-gradient(90deg,#1a2838,#2a3848,#3a4858,#2a3848,#1a2838)',borderRadius:'7px',boxShadow:'inset 0 2px 4px rgba(0,0,0,.5)'}}>
            <div style={{position:'absolute',top:0,left:'20%',right:'20%',height:'35%',background:'linear-gradient(180deg,rgba(255,255,255,.18),transparent)',borderRadius:'4px 4px 0 0'}}/>
          </div>
          {/* Vertical pipe L2 */}
          <div style={{position:'absolute',left:'28%',top:'6%',width:'10px',height:'75%',background:'linear-gradient(90deg,#141e2c,#222e3c,#141e2c)',borderRadius:'5px'}}>
            <div style={{position:'absolute',top:0,left:'15%',right:'15%',height:'28%',background:'linear-gradient(180deg,rgba(255,255,255,.12),transparent)',borderRadius:'3px 3px 0 0'}}/>
          </div>
          {/* Horizontal pipe H1 */}
          <div style={{position:'absolute',left:0,top:'36%',width:'100%',height:'11px',background:'linear-gradient(180deg,#243444,#182838,#243444)',borderRadius:'0 5px 5px 0'}}>
            <div style={{position:'absolute',top:'15%',left:0,right:0,height:'35%',background:'rgba(255,255,255,.1)',borderRadius:'2px'}}/>
          </div>
          {/* Horizontal pipe H2 */}
          <div style={{position:'absolute',left:0,top:'58%',width:'80%',height:'9px',background:'linear-gradient(180deg,#1e2e3e,#142030,#1e2e3e)',borderRadius:'0 4px 4px 0'}}/>
          {/* Flanges */}
          {[['10%','30%'],['10%','50%'],['25%','42%'],['10%','65%']].map(([l,t],i)=>(
            <div key={i} style={{position:'absolute',left:l,top:t,width:'20px',height:'28px',background:'linear-gradient(180deg,#2e3e4e,#1e2e3e)',borderRadius:'3px',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 2px 4px rgba(0,0,0,.4)'}}/>
          ))}
          {/* Orange glow pipe L */}
          <div style={{position:'absolute',left:'12%',top:'40%',width:'14px',height:'15%',background:'rgba(249,115,22,.18)',boxShadow:'0 0 14px rgba(249,115,22,.55)',borderRadius:'6px',animation:'i8pulse 2.5s ease-in-out infinite'}}/>
          <div style={{position:'absolute',left:0,top:'37%',width:'60%',height:'3px',background:'rgba(249,115,22,.22)',boxShadow:'0 0 10px rgba(249,115,22,.45)',animation:'i8pulse 2s ease-in-out infinite .5s'}}/>
          {/* Chain */}
          <div style={{position:'absolute',left:'5%',top:'18%',width:'9px',height:'36%',backgroundImage:'repeating-linear-gradient(180deg,#4a5a6a 0px,#4a5a6a 8px,#2a3a4a 8px,#2a3a4a 16px)',borderRadius:'4px',opacity:.18}}/>
          {/* Robotic arm */}
          <div style={{position:'absolute',left:'38%',top:'14%',width:'6px',height:'26%',background:'linear-gradient(90deg,#1a2838,#2a3848)',borderRadius:'4px',transform:'rotate(-14deg)',transformOrigin:'top center',boxShadow:'0 2px 6px rgba(0,0,0,.5)'}}/>
          <div style={{position:'absolute',left:'30%',top:'38%',width:'55px',height:'6px',background:'linear-gradient(180deg,#2a3848,#3a4858)',borderRadius:'3px',transform:'rotate(-5deg)',boxShadow:'0 2px 6px rgba(0,0,0,.5)'}}/>
          <div style={{position:'absolute',left:'30%',top:'38%',width:'10px',height:'10px',borderRadius:'50%',background:'#3a4858',border:'2px solid #f97316',transform:'translate(-2px,-2px)',boxShadow:'0 0 6px rgba(249,115,22,.4)'}}/>
          {/* Blueprint screen */}
          <div style={{position:'absolute',left:'5%',top:'5%',width:'72%',height:'24%',background:'rgba(0,16,42,.85)',border:'1px solid rgba(0,100,200,.2)',borderRadius:'6px',overflow:'hidden',opacity:.75}}>
            <div style={{position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,rgba(0,120,255,.08) 0,rgba(0,120,255,.08) 1px,transparent 1px,transparent 10px),repeating-linear-gradient(90deg,rgba(0,120,255,.08) 0,rgba(0,120,255,.08) 1px,transparent 1px,transparent 10px)'}}/>
            <div style={{position:'absolute',top:'8px',left:'8px',width:'20px',height:'20px',borderRadius:'50%',border:'1.5px solid rgba(0,180,255,.4)'}}/>
            <div style={{position:'absolute',top:'8px',right:'6px',width:'14px',height:'14px',border:'1px solid rgba(0,180,255,.3)',borderRadius:'2px'}}/>
            <div style={{position:'absolute',bottom:'8px',left:'6px',right:'6px',display:'flex',flexDirection:'column',gap:'3px'}}>
              {['75%','50%','85%','40%'].map((w,i)=><div key={i} style={{height:'2px',background:`rgba(0,180,255,${.25+i*.05})`,borderRadius:'1px',width:w}}/>)}
            </div>
          </div>
          {/* Gear left */}
          <div style={{position:'absolute',left:'-15%',top:'55%',opacity:.15}}>
            <Gear size={120} speed={14} reverse color="#3a5a7a"/>
          </div>
          <div style={{position:'absolute',left:'15%',bottom:'8%',opacity:.08}}>
            <Gear size={80} speed={9} color="#f97316"/>
          </div>
        </div>

        {/* ─── RIGHT WALL ─── */}
        <div style={{position:'absolute',right:0,top:0,bottom:0,width:'22%',background:'linear-gradient(-90deg,rgba(8,16,28,.95),rgba(12,22,38,.6),transparent)'}}>
          <div style={{position:'absolute',right:'12%',top:'8%',width:'14px',height:'68%',background:'linear-gradient(90deg,#1a2838,#2a3848,#3a4858,#2a3848,#1a2838)',borderRadius:'7px',boxShadow:'inset 0 2px 4px rgba(0,0,0,.5)'}}>
            <div style={{position:'absolute',top:0,left:'20%',right:'20%',height:'32%',background:'linear-gradient(180deg,rgba(255,255,255,.16),transparent)',borderRadius:'4px 4px 0 0'}}/>
          </div>
          <div style={{position:'absolute',right:'28%',top:'15%',width:'10px',height:'60%',background:'linear-gradient(90deg,#141e2c,#222e3c,#141e2c)',borderRadius:'5px'}}>
            <div style={{position:'absolute',top:0,left:'15%',right:'15%',height:'25%',background:'linear-gradient(180deg,rgba(255,255,255,.1),transparent)',borderRadius:'3px 3px 0 0'}}/>
          </div>
          <div style={{position:'absolute',right:0,top:'42%',width:'100%',height:'11px',background:'linear-gradient(180deg,#243444,#182838,#243444)',borderRadius:'5px 0 0 5px'}}>
            <div style={{position:'absolute',top:'15%',left:0,right:0,height:'35%',background:'rgba(255,255,255,.09)',borderRadius:'2px'}}/>
          </div>
          <div style={{position:'absolute',right:0,top:'62%',width:'75%',height:'9px',background:'linear-gradient(180deg,#1e2e3e,#142030,#1e2e3e)',borderRadius:'4px 0 0 4px'}}/>
          {[['10%','26%'],['10%','48%'],['25%','38%'],['10%','68%']].map(([r,t],i)=>(
            <div key={i} style={{position:'absolute',right:r,top:t,width:'20px',height:'28px',background:'linear-gradient(180deg,#2e3e4e,#1e2e3e)',borderRadius:'3px',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 2px 4px rgba(0,0,0,.4)'}}/>
          ))}
          <div style={{position:'absolute',right:'12%',top:'45%',width:'14px',height:'14%',background:'rgba(249,115,22,.16)',boxShadow:'0 0 14px rgba(249,115,22,.5)',borderRadius:'6px',animation:'i8pulse 2.5s ease-in-out infinite .8s'}}/>
          <div style={{position:'absolute',right:0,top:'43%',width:'55%',height:'3px',background:'rgba(249,115,22,.2)',boxShadow:'0 0 10px rgba(249,115,22,.42)',animation:'i8pulse 2s ease-in-out infinite 1.2s'}}/>
          <div style={{position:'absolute',right:'5%',top:'16%',width:'9px',height:'38%',backgroundImage:'repeating-linear-gradient(180deg,#4a5a6a 0px,#4a5a6a 8px,#2a3a4a 8px,#2a3a4a 16px)',borderRadius:'4px',opacity:.18}}/>
          <div style={{position:'absolute',right:'38%',top:'12%',width:'6px',height:'28%',background:'linear-gradient(90deg,#1a2838,#2a3848)',borderRadius:'4px',transform:'rotate(13deg)',transformOrigin:'top center',boxShadow:'0 2px 6px rgba(0,0,0,.5)'}}/>
          <div style={{position:'absolute',right:'28%',top:'38%',width:'55px',height:'6px',background:'linear-gradient(180deg,#2a3848,#3a4858)',borderRadius:'3px',transform:'rotate(5deg)',boxShadow:'0 2px 6px rgba(0,0,0,.5)'}}/>
          <div style={{position:'absolute',right:'28%',top:'38%',width:'10px',height:'10px',borderRadius:'50%',background:'#3a4858',border:'2px solid #f97316',transform:'translate(2px,-2px)',boxShadow:'0 0 6px rgba(249,115,22,.4)'}}/>
          <div style={{position:'absolute',right:'5%',top:'4%',width:'72%',height:'22%',background:'rgba(0,16,42,.85)',border:'1px solid rgba(0,100,200,.2)',borderRadius:'6px',overflow:'hidden',opacity:.7}}>
            <div style={{position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,rgba(0,120,255,.08) 0,rgba(0,120,255,.08) 1px,transparent 1px,transparent 10px),repeating-linear-gradient(90deg,rgba(0,120,255,.08) 0,rgba(0,120,255,.08) 1px,transparent 1px,transparent 10px)'}}/>
            <div style={{position:'absolute',top:'6px',right:'6px',width:'16px',height:'16px',border:'1px solid rgba(0,180,255,.35)',borderRadius:'2px'}}/>
            <div style={{position:'absolute',bottom:'7px',left:'5px',right:'5px',display:'flex',flexDirection:'column',gap:'3px'}}>
              {['60%','80%','45%'].map((w,i)=><div key={i} style={{height:'2px',background:'rgba(0,180,255,.3)',borderRadius:'1px',width:w}}/>)}
            </div>
          </div>
          <div style={{position:'absolute',right:'-15%',top:'48%',opacity:.13}}>
            <Gear size={130} speed={16} color="#2a4a6a"/>
          </div>
          <div style={{position:'absolute',right:'10%',bottom:'5%',opacity:.07}}>
            <Gear size={90} speed={11} reverse color="#f97316"/>
          </div>
        </div>

        {/* Top chain */}
        <div style={{position:'absolute',top:'4%',left:'20%',width:'60%',height:'9px',backgroundImage:'repeating-linear-gradient(90deg,#4a5a6a 0px,#4a5a6a 8px,#2a3a4a 8px,#2a3a4a 16px)',borderRadius:'4px',opacity:.15}}/>

        {/* ─── TOP LOGO ─── */}
        <div style={{position:'absolute',top:'5%',left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'5px',zIndex:5}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',filter:'drop-shadow(0 0 20px rgba(249,115,22,.5))'}}>
            <LogoGear size={54}/>
            <div>
              <div style={{fontSize:'32px',fontWeight:800,color:'#e8edf5',letterSpacing:'-.5px',lineHeight:1}}>
                industrial<span style={{color:'#f97316'}}>8</span>
              </div>
            </div>
          </div>
          <div style={{fontSize:'9px',letterSpacing:'3.5px',color:'rgba(249,115,22,.55)',fontWeight:700,textTransform:'uppercase'}}>
            MANUTENÇÃO INDUSTRIAL INTELIGENTE
          </div>
        </div>

        {/* Date */}
        <div style={{position:'absolute',top:'27%',left:'50%',transform:'translateX(-50%)',fontSize:'11px',fontWeight:600,letterSpacing:'2.5px',color:'rgba(210,225,240,.65)',background:'rgba(0,0,0,.4)',padding:'4px 20px',borderRadius:'14px',border:'1px solid rgba(255,255,255,.07)',zIndex:5,whiteSpace:'nowrap',textTransform:'uppercase'}}>
          {dateStr}
        </div>

        {/* ─── FLOATING LOGIN CARD ─── */}
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-46%)',zIndex:20,width:'min(320px,80vw)',animation:'i8float 5s ease-in-out infinite'}}>
          {/* Glass platform shadow */}
          <div style={{position:'absolute',bottom:'-14px',left:'-22px',right:'-22px',height:'18px',borderRadius:'10px',background:'linear-gradient(180deg,rgba(200,220,240,.1),rgba(100,140,200,.04))',border:'1px solid rgba(200,220,240,.12)',filter:'blur(1px)'}}/>
          {/* Outer glow ring */}
          <div style={{position:'absolute',inset:'-2px',borderRadius:'22px',background:'linear-gradient(135deg,rgba(249,115,22,.2),transparent 50%,rgba(249,115,22,.1))',filter:'blur(4px)',zIndex:-1}}/>

          {/* Card body */}
          <div style={{background:'rgba(9,17,34,.93)',border:'1px solid rgba(249,115,22,.32)',borderRadius:'20px',padding:'28px 28px 24px',position:'relative',overflow:'hidden',boxShadow:'0 0 80px rgba(249,115,22,.16),0 30px 80px rgba(0,0,0,.7),inset 0 1px 0 rgba(249,115,22,.2)',backdropFilter:'blur(28px)'}}>

            {/* Top orange gradient line */}
            <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,#f97316,#fb923c,#f97316,transparent)',boxShadow:'0 0 8px rgba(249,115,22,.6)'}}/>
            {/* Bottom line */}
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(249,115,22,.25),transparent)'}}/>

            {/* Chain decorations on sides */}
            <div style={{position:'absolute',left:'-6px',top:'15%',bottom:'15%',width:'8px',backgroundImage:'repeating-linear-gradient(180deg,#505a6a 0,#505a6a 7px,#303848 7px,#303848 14px)',borderRadius:'4px',opacity:.5}}/>
            <div style={{position:'absolute',right:'-6px',top:'15%',bottom:'15%',width:'8px',backgroundImage:'repeating-linear-gradient(180deg,#505a6a 0,#505a6a 7px,#303848 7px,#303848 14px)',borderRadius:'4px',opacity:.5}}/>

            {/* Card Logo — SVG gear + text, NO PNG */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:'20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'9px',filter:'drop-shadow(0 0 12px rgba(249,115,22,.6))'}}>
                <svg width="42" height="42" viewBox="0 0 52 52" fill="none">
                  <g style={{transformOrigin:'26px 26px', animation:'i8spin 5s linear infinite'}}>
                    <path d="M22 1h8l1.5 5.5a18 18 0 0 1 4.5 1.8l5-2.8 5.7 5.7-2.8 5a18 18 0 0 1 1.8 4.5L51 22v8l-5.5 1.5a18 18 0 0 1-1.8 4.5l2.8 5-5.7 5.7-5-2.8a18 18 0 0 1-4.5 1.8L30 51h-8l-1.5-5.5a18 18 0 0 1-4.5-1.8l-5 2.8-5.7-5.7 2.8-5a18 18 0 0 1-1.8-4.5L1 30v-8l5.5-1.5a18 18 0 0 1 1.8-4.5l-2.8-5 5.7-5.7 5 2.8a18 18 0 0 1 4.5-1.8L22 1z" fill="#1e3a6e" stroke="#f97316" strokeWidth="1.2"/>
                  </g>
                  <circle cx="26" cy="26" r="9" fill="#07101e" stroke="#f97316" strokeWidth="1.5"/>
                  <g style={{transformOrigin:'26px 26px', animation:'i8spin 3s linear infinite reverse'}}>
                    <circle cx="26" cy="26" r="5.5" fill="none" stroke="rgba(249,115,22,.45)" strokeWidth="1" strokeDasharray="3 2"/>
                  </g>
                  <circle cx="26" cy="26" r="2.8" fill="#f97316"/>
                  <circle cx="26" cy="26" r="1.1" fill="#07101e"/>
                </svg>
                <div>
                  <div style={{fontSize:'24px',fontWeight:800,color:'#e8edf5',letterSpacing:'-.4px',lineHeight:1}}>
                    industrial<span style={{color:'#f97316'}}>8</span>
                  </div>
                </div>
              </div>
              <div style={{fontSize:'7px',letterSpacing:'2.5px',color:'rgba(249,115,22,.5)',marginTop:'4px',fontWeight:700,textTransform:'uppercase'}}>
                MANUTENÇÃO INDUSTRIAL INTELIGENTE
              </div>
            </div>

            {/* Profile */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',justifyContent:'center',marginBottom:'20px',padding:'8px 12px',background:'rgba(249,115,22,.05)',borderRadius:'12px',border:'1px solid rgba(249,115,22,.12)'}}>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,rgba(249,115,22,.25),rgba(249,115,22,.05))',border:'1.5px solid rgba(249,115,22,.35)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>👤</div>
              <div>
                <div style={{fontSize:'13px',fontWeight:700,color:'#e8edf5'}}>Renato Bauer</div>
                <div style={{fontSize:'8px',color:'rgba(249,115,22,.6)',textTransform:'uppercase',letterSpacing:'.5px'}}>Administrador</div>
              </div>
            </div>

            {err && <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:'10px',padding:'8px 12px',marginBottom:'12px',fontSize:'11px',color:'#ef4444'}}>{err}</div>}

            {/* Email */}
            <div style={{marginBottom:'12px'}}>
              <div style={{fontSize:'8px',fontWeight:700,letterSpacing:'1.5px',color:'rgba(249,115,22,.65)',textTransform:'uppercase',marginBottom:'5px',paddingLeft:'2px'}}>✉ E-MAIL</div>
              <input className="i8inp" value={email} onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&document.getElementById('i8pw')?.focus()}
                type="email" placeholder="seu@email.com" autoComplete="email"
                style={{width:'100%',background:'rgba(249,115,22,.04)',border:'1px solid rgba(249,115,22,.18)',borderRadius:'11px',padding:'11px 15px',color:'#e8edf5',fontFamily:"'Sora',system-ui",fontSize:'12px',transition:'all .2s',display:'block'}}/>
            </div>

            {/* Password */}
            <div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'8px',fontWeight:700,letterSpacing:'1.5px',color:'rgba(249,115,22,.65)',textTransform:'uppercase',marginBottom:'5px',paddingLeft:'2px'}}>🔒 SENHA</div>
              <input id="i8pw" className="i8inp" value={pass} onChange={e=>setPass(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&login()}
                type="password" placeholder="••••••••" autoComplete="current-password"
                style={{width:'100%',background:'rgba(249,115,22,.04)',border:'1px solid rgba(249,115,22,.18)',borderRadius:'11px',padding:'11px 15px',color:'#e8edf5',fontFamily:"'Sora',system-ui",fontSize:'12px',transition:'all .2s',display:'block'}}/>
            </div>

            {/* Button */}
            <button className="i8btn" onClick={login} disabled={loading}
              style={{width:'100%',padding:'13px',border:'none',borderRadius:'13px',background:loading?'rgba(249,115,22,.15)':'linear-gradient(135deg,#f97316,#c85a00)',color:loading?'rgba(249,115,22,.4)':'#fff',fontFamily:"'Sora',system-ui",fontSize:'12px',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',cursor:loading?'not-allowed':'pointer',boxShadow:loading?'none':'0 5px 24px rgba(249,115,22,.5)',transition:'all .2s',display:'block'}}>
              {loading?'⚙️ Autenticando...':'▶ ACESSAR SISTEMA'}
            </button>

            <div style={{textAlign:'center',marginTop:'12px',fontSize:'8px',color:'rgba(255,255,255,.12)',letterSpacing:'1.5px'}}>
              INDUSTRIAL8 · ACESSO RESTRITO
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
