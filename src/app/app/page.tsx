'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'
import { ROLES } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Icons ─────────────────────────────────────────────────────────────────
const IC = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  os:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  mach: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  maint:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  pm:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  task: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  parts:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  sup:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  rep:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  users:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  cfg:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  bell: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  fin:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  wood: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  fuel: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 22V8l9-6 9 6v14"/><path d="M10 22V12h4v10"/></svg>,
  load: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/></svg>,
  drv:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  cli:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  qr:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3v3m0-3v-2h-2m5 5v-2m-7 2h2m0-5h2v2m2-2v3"/><rect x="5" y="5" width="1" height="1"/><rect x="18" y="5" width="1" height="1"/><rect x="5" y="18" width="1" height="1"/></svg>,
  down: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  sadm: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  qr:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><rect x="5" y="5" width="1" height="1"/><rect x="18" y="5" width="1" height="1"/><rect x="5" y="18" width="1" height="1"/></svg>,
  down: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  sadm: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  out:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  gear: '⚙️',
}

// ─── Lazy page imports ──────────────────────────────────────────────────────
import DashPage    from '@/app/pages/DashPage'
import OSPage      from '@/app/pages/OSPage'
import MachPage    from '@/app/pages/MachPage'
import PMPage      from '@/app/pages/PMPage'
import TasksPage   from '@/app/pages/TasksPage'
import PartsPage   from '@/app/pages/PartsPage'
import SuppPage    from '@/app/pages/SuppPage'
import ReportsPage from '@/app/pages/ReportsPage'
import UsersPage   from '@/app/pages/UsersPage'
import SettPage    from '@/app/pages/SettPage'
import LoginPage   from '@/app/pages/LoginPage'
import FinancePage    from '@/app/pages/FinancePage'
import QRPage         from '@/app/pages/QRPage'
import DowntimePage   from '@/app/pages/DowntimePage'
import SuperAdminPage from '@/app/pages/SuperAdminPage'
import ChatPage        from '@/app/pages/ChatPage'
import SchedulingPage  from '@/app/pages/SchedulingPage'
import DocumentsPage   from '@/app/pages/DocumentsPage'
import EPIPage         from '@/app/pages/EPIPage'
import OEEPage         from '@/app/pages/OEEPage'
import TrainingPage    from '@/app/pages/TrainingPage'
import AuditPage       from '@/app/pages/AuditPage'
import EnergyPage      from '@/app/pages/EnergyPage'
import WoodPage        from '@/app/pages/WoodPage'
import SalesPage       from '@/app/pages/SalesPage'

type Page = 'dashboard'|'os'|'machines'|'pm'|'tasks'|'parts'|'suppliers'|'reports'|'users'|'settings'|'finance'|'qr'|'downtime'|'superadmin'|'chat'|'scheduling'|'documents'|'epi'|'oee'|'training'|'audit'|'energy'|'wood'|'sales'


export default function App() {
  const [user, setUser]    = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile|null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]    = useState<Page>('dashboard')
  const [splashDone, setSplashDone] = useState(false)
  const [userModules, setUserModules] = useState<string[]>([])

  // Auth init
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user)
        loadProfile(data.session.user.id)
        loadUserModules(data.session.user.id)
      } else {
        setLoading(false)
        setSplashDone(true)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
        loadUserModules(session.user.id)
      } else {
        setUser(null); setProfile(null); setLoading(false); setSplashDone(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadUserModules(uid: string) {
    const { data } = await supabase.from('user_permissions').select('module_id').eq('user_id', uid).eq('enabled', true)
    if (data && data.length > 0) {
      setUserModules(data.map((d:any) => d.module_id))
    }
  }

  async function loadProfile(uid: string) {
    try {
      const { data: authUser } = await supabase.auth.getUser()
      const email = authUser?.user?.email || ''
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
      if (data) {
        let name = data.display_name || ''
        if (!name || (name.includes('-') && name.length > 30)) {
          name = email.split('@')[0].replace(/[._]/g,' ').replace(/\w/g,(c:string)=>c.toUpperCase())
          await supabase.from('profiles').update({ display_name: name, email }).eq('id', uid)
        }
        setProfile({ ...data, display_name: name, email: data.email || email })
      } else {
        const name = email.split('@')[0].replace(/[._]/g,' ').replace(/\w/g,(c:string)=>c.toUpperCase())
        const p: any = { id: uid, email, role: 'admin', display_name: name }
        await supabase.from('profiles').upsert(p)
        setProfile(p)
      }
    } catch(e) { console.error(e) }
    finally { setTimeout(() => { setLoading(false); setSplashDone(true) }, 300) }
  }
  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setPage('dashboard')
  }, [])

  const can = useCallback((perm: string) => {
    if (!profile) return false
    if (profile.role === 'superadmin' || profile.role === 'admin') return true
    const perms = ROLES[profile.role]?.perms || []
    return perms.includes(perm) || perms.includes('all')
  }, [profile])

  // ─── Splash ────────────────────────────────────────────────────────────────
  if (!splashDone) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'#06101e',overflow:'hidden'}}>
      <style>{`@keyframes splashSpin{to{transform:rotate(360deg)}} @keyframes splashPulse{0%,100%{opacity:.3}50%{opacity:.7}} @keyframes splashFill{from{width:0}to{width:100%}}`}</style>
      {/* Grid */}
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(249,115,22,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,.025) 1px,transparent 1px)',backgroundSize:'50px 50px',animation:'splashPulse 4s ease-in-out infinite'}}/>
      {/* Glow */}
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'400px',height:'400px',borderRadius:'50%',background:'radial-gradient(circle,rgba(249,115,22,.1),transparent 65%)',animation:'splashPulse 3s ease-in-out infinite'}}/>
      {/* Content */}
      <div className="relative z-10 text-center px-6">
        {/* Animated gear */}
        <svg width="72" height="72" viewBox="0 0 52 52" fill="none" className="mx-auto mb-4" style={{filter:'drop-shadow(0 0 16px rgba(249,115,22,.8))'}}>
          <g style={{transformOrigin:'26px 26px',animation:'splashSpin 7s linear infinite'}}>
            <path d="M22 1h8l1.5 5.5a18 18 0 0 1 4.5 1.8l5-2.8 5.7 5.7-2.8 5a18 18 0 0 1 1.8 4.5L51 22v8l-5.5 1.5a18 18 0 0 1-1.8 4.5l2.8 5-5.7 5.7-5-2.8a18 18 0 0 1-4.5 1.8L30 51h-8l-1.5-5.5a18 18 0 0 1-4.5-1.8l-5 2.8-5.7-5.7 2.8-5a18 18 0 0 1-1.8-4.5L1 30v-8l5.5-1.5a18 18 0 0 1 1.8-4.5l-2.8-5 5.7-5.7 5 2.8a18 18 0 0 1 4.5-1.8L22 1z" fill="#1e3a6e" stroke="#f97316" strokeWidth="1.3"/>
          </g>
          <circle cx="26" cy="26" r="9" fill="#06101e" stroke="#f97316" strokeWidth="1.5"/>
          <g style={{transformOrigin:'26px 26px',animation:'splashSpin 4s linear infinite reverse'}}>
            <circle cx="26" cy="26" r="5.5" fill="none" stroke="rgba(249,115,22,.45)" strokeWidth="1" strokeDasharray="3 2"/>
          </g>
          <circle cx="26" cy="26" r="2.8" fill="#f97316"/>
          <circle cx="26" cy="26" r="1.1" fill="#06101e"/>
        </svg>
        {/* Logo text */}
        <div style={{fontSize:'36px',fontWeight:800,color:'#e8edf5',letterSpacing:'-.5px',lineHeight:1,fontFamily:"'Sora',system-ui",filter:'drop-shadow(0 0 12px rgba(249,115,22,.4))'}}>
          industrial<span style={{color:'#f97316'}}>8</span>
        </div>
        <div style={{fontSize:'9px',letterSpacing:'3.5px',color:'rgba(249,115,22,.55)',fontWeight:700,textTransform:'uppercase',marginTop:'6px'}}>
          MANUTENÇÃO INDUSTRIAL INTELIGENTE
        </div>
        {/* Progress bar */}
        <div style={{width:'180px',height:'2px',background:'rgba(249,115,22,.15)',borderRadius:'2px',margin:'20px auto 0',overflow:'hidden'}}>
          <div style={{height:'100%',background:'linear-gradient(90deg,#f97316,#fb923c)',borderRadius:'2px',animation:'splashFill 1.2s ease-out forwards',boxShadow:'0 0 8px rgba(249,115,22,.7)'}}/>
        </div>
      </div>
    </div>
  )

  // ─── Login ─────────────────────────────────────────────────────────────────
  if (!user) return <LoginPage onLogin={() => {}} />

  const now = new Date()
  const DPT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const MPT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ALL_NAV: any[] = [
    {id:'dashboard' as Page,  label:'Início',      icon:IC.home},
    {id:'os' as Page,         label:'OS',          icon:IC.os},
    {id:'machines' as Page,   label:'Máquinas',    icon:IC.mach},
    {id:'pm' as Page,         label:'MP',          icon:IC.pm},
    {id:'tasks' as Page,      label:'Tarefas',     icon:IC.task},
    {id:'parts' as Page,      label:'Peças',       icon:IC.parts},
    {id:'suppliers' as Page,  label:'Fornec.',     icon:IC.sup},
    {id:'downtime' as Page,   label:'Paradas',     icon:IC.down},
    {id:'finance' as Page,    label:'Financeiro',  icon:IC.fin},
    {id:'reports' as Page,    label:'Relatórios',  icon:IC.rep},
    {id:'qr' as Page,         label:'QR Codes',    icon:IC.qr},
    {id:'chat' as Page,       label:'Conversas',   icon:IC.chat},
    {id:'scheduling' as Page, label:'Agendamentos',icon:<span>📅</span>},
    {id:'documents' as Page,  label:'Documentos',  icon:<span>📄</span>},
    {id:'epi' as Page,        label:'EPI/Seg.',    icon:<span>🦺</span>},
    {id:'oee' as Page,        label:'OEE',         icon:<span>📈</span>},
    {id:'training' as Page,   label:'Treinamentos',icon:<span>🎓</span>},
    {id:'audit' as Page,      label:'Auditorias',  icon:<span>🔍</span>},
    {id:'energy' as Page,     label:'Energia',     icon:<span>⚡</span>},
    {id:'wood' as Page,       label:'Madeira',     icon:<span>🪵</span>},
    {id:'sales' as Page,      label:'Vendas',      icon:<span>🛒</span>},
    {id:'users' as Page,      label:'Usuários',    icon:IC.users},
    {id:'superadmin' as Page, label:'Super Admin', icon:IC.sadm},
    {id:'settings' as Page,   label:'Config',      icon:IC.cfg},
  ]

  const NAV = ALL_NAV.filter(n => {
    if (profile?.role === 'superadmin' || profile?.role === 'admin') return true
    if (userModules.length === 0) return ['dashboard','os','pm','tasks'].includes(n.id)
    return userModules.includes(n.id)
  })

  const PageMap: Record<Page, React.ReactNode> = {
    dashboard:   <DashPage    profile={profile} can={can} onNavigate={setPage} />,
    os:          <OSPage      profile={profile} can={can} />,
    machines:    <MachPage    profile={profile} can={can} />,
    pm:          <PMPage      profile={profile} can={can} />,
    tasks:       <TasksPage   profile={profile} can={can} />,
    parts:       <PartsPage   profile={profile} can={can} />,
    suppliers:   <SuppPage    profile={profile} can={can} />,
    reports:     <ReportsPage profile={profile} can={can} />,
    users:       <UsersPage   profile={profile} can={can} />,
    settings:    <SettPage      profile={profile} onSave={p => setProfile(p)} />,
    qr:          <QRPage        profile={profile} can={can} onNavigate={setPage} />,
    downtime:    <DowntimePage  profile={profile} can={can} />,
    chat:        <ChatPage      profile={profile} />,
    finance:     <FinancePage   profile={profile} can={can} />,
    scheduling:  <SchedulingPage  profile={profile} can={can} />,
    documents:   <DocumentsPage   profile={profile} can={can} />,
    epi:         <EPIPage         profile={profile} can={can} />,
    oee:         <OEEPage         profile={profile} can={can} />,
    training:    <TrainingPage    profile={profile} can={can} />,
    audit:       <AuditPage       profile={profile} can={can} />,
    energy:      <EnergyPage      profile={profile} can={can} />,
    wood:        <WoodPage        profile={profile} can={can} />,
    sales:       <SalesPage       profile={profile} can={can} />,
    superadmin:  <SuperAdminPage profile={profile} />,
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{background:'var(--bg)'}}>
      {/* HEADER */}
      <style>{`@keyframes hdrGearSpin { to { transform: rotate(360deg) } }`}</style>
      <header className="flex-shrink-0" style={{paddingTop:'var(--sat)',background:'rgba(10,22,40,.98)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(249,115,22,.25)',zIndex:50,boxShadow:'0 2px 20px rgba(249,115,22,.1)'}}>
        {/* Orange top line */}
        <div style={{height:'2px',background:'linear-gradient(90deg,transparent,#f97316,#fb923c,#f97316,transparent)',position:'absolute',top:0,left:0,right:0}}/>
        <div className="h-14 flex items-center justify-between px-3" style={{marginTop:'2px'}}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <svg width="30" height="30" viewBox="0 0 52 52" fill="none" style={{flexShrink:0}}>
                <g style={{transformOrigin:'26px 26px',animation:'hdrGearSpin 8s linear infinite'}}>
                  <path d="M22 1h8l1.5 5.5a18 18 0 0 1 4.5 1.8l5-2.8 5.7 5.7-2.8 5a18 18 0 0 1 1.8 4.5L51 22v8l-5.5 1.5a18 18 0 0 1-1.8 4.5l2.8 5-5.7 5.7-5-2.8a18 18 0 0 1-4.5 1.8L30 51h-8l-1.5-5.5a18 18 0 0 1-4.5-1.8l-5 2.8-5.7-5.7 2.8-5a18 18 0 0 1-1.8-4.5L1 30v-8l5.5-1.5a18 18 0 0 1 1.8-4.5l-2.8-5 5.7-5.7 5 2.8a18 18 0 0 1 4.5-1.8L22 1z" fill="#1e3a6e" stroke="#f97316" strokeWidth="1.2"/>
                </g>
                <circle cx="26" cy="26" r="9" fill="#06101e" stroke="#f97316" strokeWidth="1.5"/>
                <g style={{transformOrigin:'26px 26px',animation:'hdrGearSpin 5s linear infinite reverse'}}>
                  <circle cx="26" cy="26" r="5.5" fill="none" stroke="rgba(249,115,22,.4)" strokeWidth="1" strokeDasharray="3 2"/>
                </g>
                <circle cx="26" cy="26" r="2.8" fill="#f97316"/>
                <circle cx="26" cy="26" r="1.1" fill="#06101e"/>
              </svg>
              <div style={{display:'flex',flexDirection:'column'}}>
                <div style={{fontSize:'15px',fontWeight:800,color:'#e8edf5',letterSpacing:'-.3px',lineHeight:1,fontFamily:"'Sora',system-ui"}}>
                  industrial<span style={{color:'#f97316'}}>8</span>
                </div>
                <div style={{fontSize:'7px',letterSpacing:'1.5px',color:'rgba(249,115,22,.5)',fontWeight:700,textTransform:'uppercase'}}>{DPT[now.getDay()]}, {now.getDate()} {MPT[now.getMonth()]}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs" style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t2)'}}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{background:'rgba(0,212,255,.15)',color:'var(--cy)'}}>
                {(profile?.display_name||profile?.email||'?')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold" style={{color:'var(--t1)'}}>{profile?.display_name && !profile.display_name.includes('-') ? profile.display_name : (profile?.email?.split('@')[0] || 'Usuário')}</div>
                <div style={{color:'var(--cy)',fontSize:'9px',fontWeight:700}}>{ROLES[profile?.role||'viewer']?.label}</div>
              </div>
            </div>
            <button onClick={logout} className="w-9 h-9 rounded-lg flex items-center justify-center transition-all" style={{border:'none',background:'transparent',color:'var(--rd)',cursor:'pointer'}} title="Sair">
              {IC.out}
            </button>
          </div>
        </div>
      </header>

      {/* NAV */}
      <nav className="flex-shrink-0 flex overflow-x-auto" style={{background:'rgba(12,20,36,.98)',borderBottom:'1px solid rgba(249,115,22,.2)',scrollbarWidth:'none',boxShadow:'0 4px 12px rgba(0,0,0,.4)'}}>
        <style>{`.nav-scroll::-webkit-scrollbar{display:none}`}</style>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)}
            className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 py-2 border-none cursor-pointer transition-all relative"
            style={{
              background:'transparent',
              color: page===n.id ? 'var(--cy)' : 'var(--t3)',
              fontFamily:'Sora,system-ui,sans-serif',fontSize:'8px',fontWeight:700,
              textTransform:'uppercase',letterSpacing:'.4px',minWidth:'52px'
            }}>
            {n.icon}
            <span>{n.label}</span>
            {page===n.id && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-sm" style={{background:'linear-gradient(90deg,transparent,#f97316,transparent)',boxShadow:'0 0 8px rgba(249,115,22,.8)'}}/>}
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{WebkitOverflowScrolling:'touch',paddingBottom:'calc(var(--sab) + 12px)'}}>
        <div key={page} className="page-enter p-3 min-h-full">
          {PageMap[page]}
        </div>
      </div>
    </div>
  )
}
