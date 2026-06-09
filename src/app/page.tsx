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
  out:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  gear: '⚙️',
}

// ─── Lazy page imports ──────────────────────────────────────────────────────
import DashPage    from './pages/DashPage'
import OSPage      from './pages/OSPage'
import MachPage    from './pages/MachPage'
import MaintPage   from './pages/MaintPage'
import PMPage      from './pages/PMPage'
import TasksPage   from './pages/TasksPage'
import PartsPage   from './pages/PartsPage'
import SuppPage    from './pages/SuppPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage   from './pages/UsersPage'
import SettPage    from './pages/SettPage'
import LoginPage   from './pages/LoginPage'

type Page = 'dashboard'|'os'|'machines'|'maintenance'|'pm'|'tasks'|'parts'|'suppliers'|'reports'|'users'|'settings'|'finance'

export default function App() {
  const [user, setUser]    = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile|null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]    = useState<Page>('dashboard')
  const [splashDone, setSplashDone] = useState(false)

  // Auth init
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user)
        loadProfile(data.session.user.id)
      } else {
        setLoading(false)
        setSplashDone(true)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setUser(null); setProfile(null); setLoading(false); setSplashDone(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(uid: string) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
      if (data) {
        setProfile(data)
      } else {
        // Auto-create profile
        const p: any = { id: uid, email: supabase.auth.getUser().then(r=>r.data.user?.email), role: 'admin', display_name: uid }
        await supabase.from('profiles').upsert(p)
        setProfile(p)
      }
    } catch { }
    finally {
      setTimeout(() => { setLoading(false); setSplashDone(true) }, 300)
    }
  }

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setPage('dashboard')
  }, [])

  const can = useCallback((perm: string) => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    const perms = ROLES[profile.role]?.perms || []
    return perms.includes(perm) || perms.includes('all')
  }, [profile])

  // ─── Splash ────────────────────────────────────────────────────────────────
  if (!splashDone) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'var(--bg)'}}>
      <div className="text-center px-6">
        <div className="text-6xl spin inline-block mb-3">⚙️</div>
        <div className="font-bebas text-5xl tracking-widest" style={{color:'var(--cy)'}}>AgendaPro</div>
        <div className="text-xs tracking-widest mt-1" style={{color:'var(--t3)'}}>CMMS · GESTÃO INDUSTRIAL</div>
        <div className="w-48 h-1 rounded-full mx-auto mt-5 overflow-hidden" style={{background:'var(--s1)'}}>
          <div className="h-full rounded-full" style={{background:'linear-gradient(90deg,var(--cy),#7c3aed)',animation:'sfill 1.4s ease-out forwards'}}/>
        </div>
        <style>{`@keyframes sfill{to{width:100%}} div.h-full{width:0}`}</style>
        <div className="text-xs mt-2" style={{color:'var(--t3)'}}>Conectando...</div>
      </div>
    </div>
  )

  // ─── Login ─────────────────────────────────────────────────────────────────
  if (!user) return <LoginPage onLogin={() => {}} />

  const now = new Date()
  const DPT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const MPT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NAV: any[] = [
    {id:'dashboard' as Page,  label:'Início',    icon:IC.home},
    {id:'os' as Page,         label:'OS',        icon:IC.os},
    {id:'machines' as Page,   label:'Máquinas',  icon:IC.mach},
    {id:'maintenance' as Page,label:'Manutenção',icon:IC.maint},
    {id:'pm' as Page,         label:'MP',        icon:IC.pm},
    {id:'tasks' as Page,      label:'Tarefas',   icon:IC.task},
    {id:'parts' as Page,      label:'Peças',     icon:IC.parts},
    {id:'suppliers' as Page,  label:'Fornec.',   icon:IC.sup},
    {id:'reports' as Page,    label:'Relatórios',icon:IC.rep},
    {id:'finance' as Page,    label:'Financeiro',icon:IC.fin},
    {id:'users' as Page,      label:'Usuários',   icon:IC.users, perm:'admin'},
    {id:'settings' as Page,   label:'Config',    icon:IC.cfg},
  ].filter(n => !n.perm || profile?.role === n.perm)

  const PageMap: Record<Page, React.ReactNode> = {
    dashboard:   <DashPage    profile={profile} can={can} onNavigate={setPage} />,
    os:          <OSPage      profile={profile} can={can} />,
    machines:    <MachPage    profile={profile} can={can} />,
    maintenance: <MaintPage   profile={profile} can={can} />,
    pm:          <PMPage      profile={profile} can={can} />,
    tasks:       <TasksPage   profile={profile} can={can} />,
    parts:       <PartsPage   profile={profile} can={can} />,
    suppliers:   <SuppPage    profile={profile} can={can} />,
    reports:     <ReportsPage profile={profile} can={can} />,
    users:       <UsersPage   profile={profile} can={can} />,
    settings:    <SettPage    profile={profile} onSave={p => setProfile(p)} />,
    finance:     <FinancePage profile={profile} can={can} />,
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{background:'var(--bg)'}}>
      {/* HEADER */}
      <header className="flex-shrink-0" style={{paddingTop:'var(--sat)',background:'rgba(6,13,26,.97)',backdropFilter:'blur(20px)',borderBottom:'1px solid var(--bd)',zIndex:50}}>
        <div className="h-14 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>⚙️</div>
            <div>
              <div className="text-sm font-bold leading-tight">AgendaPro CMMS</div>
              <div className="text-xs" style={{color:'var(--t2)'}}>{DPT[now.getDay()]}, {now.getDate()} {MPT[now.getMonth()]} {now.getFullYear()}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs" style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t2)'}}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{background:'rgba(0,212,255,.15)',color:'var(--cy)'}}>
                {(profile?.display_name||profile?.email||'?')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold" style={{color:'var(--t1)'}}>{profile?.display_name || 'Usuário'}</div>
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
      <nav className="flex-shrink-0 flex overflow-x-auto" style={{background:'var(--bg2)',borderBottom:'2px solid var(--bd)',scrollbarWidth:'none'}}>
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
            {page===n.id && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-sm" style={{background:'var(--cy)'}}/>}
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
