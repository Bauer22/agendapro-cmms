'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'

const INTERNAL_DOMAIN = 'industrial8-internal.com'
function usernameToEmail(u: string) {
  return `${(u||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@${INTERNAL_DOMAIN}`
}
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null }

const PLANS = [
  {value:'trial',     label:'🔵 Trial (30 dias)'},
  {value:'basic',     label:'🟢 Basic'},
  {value:'pro',       label:'🟡 Pro'},
  {value:'enterprise',label:'🟣 Enterprise'},
]
const PLAN_COLORS: Record<string,string> = {trial:'blue',basic:'green',pro:'amber',enterprise:'purple'}
const PLAN_PRICES: Record<string,string> = {trial:'Gratuito',basic:'R$ 297/mês',pro:'R$ 550/mês',enterprise:'R$ 1.200/mês'}
const PLAN_VALUES: Record<string,number> = {trial:0, basic:297, pro:550, enterprise:1200}

export default function SuperAdminPage({ profile }: Props) {
  const [companies, setCompanies] = useState<any[]>([])
  const [users, setUsers]         = useState<any[]>([])
  const [modStats, setModStats]   = useState<any[]>([])
  const [stats, setStats]         = useState<any>({})
  const [loading, setLoad]        = useState(true)
  const [modal, setModal]         = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [editing, setEdit]        = useState<any>({})
  const [newUser, setNewUser]     = useState<any>({})
  const [tab, setTab]             = useState('gerencial')
  const [allModules, setAllModules] = useState<any[]>([])
  const [companyMods, setCompanyMods] = useState<Set<string>>(new Set())
  // cargos/setores dinâmicos: {role, label, modules:Set, protegido}
  const [cargos, setCargos]       = useState<any[]>([])
  const [roleMods, setRoleMods]   = useState<Record<string,Set<string>>>({})  // role -> módulos
  const [savingRole, setSavingRole] = useState('')
  const [novoCargo, setNovoCargo] = useState('')  // nome do novo cargo a criar
  const { confirm, dialog }       = useConfirm()

  async function loadRoleMods() {
    const { data } = await supabase.from('role_modules').select('role,label,modules,protegido').order('role')
    setCargos(data || [])
    const map: Record<string,Set<string>> = {}
    ;(data||[]).forEach((r:any)=>{ map[r.role] = new Set(r.modules||[]) })
    setRoleMods(map)
  }
  function setLabel(role:string, label:string) {
    setCargos(prev => prev.map(c => c.role===role ? {...c, label} : c))
  }
  function toggleRoleMod(role:string, modId:string) {
    setRoleMods(prev => {
      const s = new Set(prev[role] || [])
      if (s.has(modId)) s.delete(modId); else s.add(modId)
      if (modId !== '*') s.delete('*')
      return { ...prev, [role]: s }
    })
  }
  function toggleRoleAll(role:string, marcarTudo:boolean) {
    setRoleMods(prev => ({ ...prev, [role]: new Set(marcarTudo ? ['*'] : []) }))
  }
  async function salvarRoleMods(role:string) {
    setSavingRole(role)
    const modules = Array.from(roleMods[role] || [])
    const label = cargos.find(c=>c.role===role)?.label || role
    const { error } = await supabase.from('role_modules').upsert({ role, label, modules, updated_at:new Date().toISOString() }, { onConflict:'role' })
    setSavingRole('')
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Cargo salvo ✅ (o usuário vê na próxima vez que abrir)')
  }
  async function criarCargo() {
    const nome = novoCargo.trim()
    if (!nome) { toast.error('Digite o nome do cargo/setor'); return }
    // código do cargo: minúsculo, sem acento/espaço
    const role = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
    if (!role) { toast.error('Nome inválido'); return }
    if (cargos.some(c=>c.role===role)) { toast.error('Já existe um cargo com esse nome'); return }
    const { error } = await supabase.from('role_modules').insert({ role, label:nome, modules:['dashboard'], protegido:false })
    if (error) { toast.error('Erro: '+error.message); return }
    setNovoCargo(''); await loadRoleMods()
    toast.success(`Cargo "${nome}" criado ✅ — agora escolha as abas dele`)
  }
  async function excluirCargo(c:any) {
    if (c.protegido) { toast.error('Este cargo é protegido e não pode ser excluído'); return }
    if (!(await confirm(`Excluir o cargo "${c.label||c.role}"? Usuários com esse cargo ficarão sem abas definidas.`))) return
    const { error } = await supabase.from('role_modules').delete().eq('role', c.role)
    if (error) { toast.error('Erro: '+error.message); return }
    await loadRoleMods()
    toast.success('Cargo excluído')
  }

  // Carrega a lista global de módulos uma vez
  useEffect(() => {
    supabase.from('modules').select('id,label,icon,category,sort_order').order('sort_order')
      .then(({data}) => setAllModules(data || []))
    loadRoleMods()
  }, [])

  // Ao abrir uma empresa para editar, carrega os módulos liberados dela
  async function abrirEmpresa(c: any) {
    setEdit(c)
    const { data } = await supabase.from('company_modules')
      .select('module_id,enabled').eq('company_id', c.id)
    const ativos = new Set<string>((data||[]).filter((m:any)=>m.enabled).map((m:any)=>m.module_id))
    setCompanyMods(ativos)
    setModal(true)
  }

  function toggleModulo(moduleId: string) {
    setCompanyMods(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId)
      return next
    })
  }

  async function salvarModulosEmpresa(companyId: string) {
    // Estratégia simples: apaga os vínculos atuais e regrava os marcados
    await supabase.from('company_modules').delete().eq('company_id', companyId)
    const rows = Array.from(companyMods).map(mid => ({
      company_id: companyId, module_id: mid, enabled: true,
    }))
    if (rows.length > 0) {
      await supabase.from('company_modules').insert(rows)
    }
  }

  useEffect(() => { load() }, [tab])

  async function load() {
    if (tab === 'companies' || tab === 'gerencial') {
      const { data } = await supabase.from('companies').select('*').order('created_at', {ascending:false})
      setCompanies(data||[])
      // Get stats per company
      const companyIds = (data||[]).map((c:any)=>c.id)
      if (companyIds.length > 0) {
        const [profs, os] = await Promise.all([
          supabase.from('profiles').select('company_id,blocked').in('company_id', companyIds),
          supabase.from('work_orders').select('company_id,status').in('company_id', companyIds),
        ])
        const statsMap: Record<string,any> = {}
        companyIds.forEach((id:string) => {
          statsMap[id] = {
            users: (profs.data||[]).filter((p:any)=>p.company_id===id).length,
            osTotal: (os.data||[]).filter((o:any)=>o.company_id===id).length,
            osOpen: (os.data||[]).filter((o:any)=>o.company_id===id&&o.status==='open').length,
          }
        })
        setStats(statsMap)
      }
      // Para o dashboard gerencial: usuários e módulos liberados
      if (tab === 'gerencial') {
        const [allProfs, allMods] = await Promise.all([
          supabase.from('profiles').select('id,blocked,company_id'),
          supabase.from('company_modules').select('module_id,enabled').eq('enabled', true),
        ])
        setUsers(allProfs.data||[])
        setModStats(allMods.data||[])
      }
    } else {
      const { data } = await supabase.from('profiles').select('*,companies(name)').order('created_at',{ascending:false})
      setUsers(data||[])
    }
    setLoad(false)
  }

  async function desbloquearUsuario(u: any) {
    const ok = await confirm(`Desbloquear o usuário ${u.display_name || u.email}? As tentativas serão zeradas.`)
    if (!ok) return
    const { error } = await supabase.from('profiles')
      .update({ blocked: false, failed_attempts: 0, blocked_at: null })
      .eq('id', u.id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Usuário desbloqueado ✅')
    load()
  }

  async function saveCompany() {
    if (!editing.name) { toast.error('Informe o nome da empresa'); return }
    if (!editing.slug) { editing.slug = editing.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') }
    const payload = { ...editing, max_users: editing.max_users ? parseInt(editing.max_users, 10) : 5 }
    try {
      if (editing.id) {
        await supabase.from('companies').update(payload).eq('id', editing.id)
        await salvarModulosEmpresa(editing.id)
        toast.success('Empresa atualizada ✅')
      } else {
        const { data, error } = await supabase.from('companies').insert({ ...payload, active:true, plan: editing.plan||'trial', plan_expires: editing.plan_expires || new Date(Date.now()+30*86400000).toISOString().split('T')[0] }).select('id').single()
        if (error) throw error
        if (data?.id) await salvarModulosEmpresa(data.id)
        toast.success('Empresa criada ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function inviteUser() {
    if (!newUser.username||!newUser.company_id) { toast.error('Preencha usuário e empresa'); return }
    if (!/^[a-z0-9._-]{3,}$/i.test(newUser.username)) { toast.error('Usuário inválido (mín. 3 caracteres, sem espaços)'); return }
    if (!newUser.password || newUser.password.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres'); return }
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          display_name: newUser.display_name || newUser.username,
          role: newUser.role || 'operator',
          company_id: newUser.company_id,
        })
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error('Erro: ' + (result.error || 'Falha ao criar usuário'))
        return
      }
      toast.success(`Usuário "${result.username}" criado ✅`)
      setUserModal(false); setNewUser({}); load()
    } catch(e:any) {
      toast.error('Erro: '+e.message)
    }
  }

  async function toggleCompany(c: any) {
    await supabase.from('companies').update({ active: !c.active }).eq('id', c.id)
    toast.success(c.active ? 'Empresa suspensa' : 'Empresa reativada')
    load()
  }

  async function delCompany(id: string) {
    if (!await confirm('ATENÇÃO: Excluir esta empresa apaga TODOS os dados dela. Continuar?')) return
    await supabase.from('companies').delete().eq('id', id)
    toast.success('Empresa excluída'); load()
  }

  const totalRevenue = companies.filter(c=>c.active&&c.plan!=='trial').reduce((s,c)=>{
    const prices: Record<string,number> = {basic:297,pro:550,enterprise:1200}
    return s + (prices[c.plan]||0)
  }, 0)

  return (
    <div>
      {dialog}

      {/* Revenue KPIs */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <div className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="absolute top-0 inset-x-0 h-0.5" style={{background:'var(--cy)'}}/>
          <div className="font-bebas text-2xl" style={{color:'var(--cy)'}}>{companies.filter(c=>c.active).length}</div>
          <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>Empresas Ativas</div>
        </div>
        <div className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="absolute top-0 inset-x-0 h-0.5" style={{background:'var(--gn)'}}/>
          <div className="font-bebas text-2xl" style={{color:'var(--gn)'}}>R${totalRevenue.toLocaleString()}</div>
          <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>Receita/Mês</div>
        </div>
        <div className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="absolute top-0 inset-x-0 h-0.5" style={{background:'var(--am)'}}/>
          <div className="font-bebas text-2xl" style={{color:'var(--am)'}}>{users.length}</div>
          <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>Usuários Total</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3">
        {[{k:'gerencial',l:'📈 Gerencial'},{k:'companies',l:'🏭 Empresas'},{k:'users',l:'👥 Usuários'},{k:'permissoes',l:'🔐 Permissões'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='gerencial' && (() => {
        const hoje = td()
        const em7dias = new Date(Date.now()+7*86400000).toISOString().split('T')[0]
        const ativas = companies.filter((c:any)=>c.active)
        const inativas = companies.filter((c:any)=>!c.active)
        const trials = companies.filter((c:any)=>c.plan==='trial')
        const pagantes = companies.filter((c:any)=>c.active && c.plan!=='trial')
        const mrr = pagantes.reduce((s:number,c:any)=>s+(PLAN_VALUES[c.plan]||0),0)
        const arr = mrr*12
        const ticket = pagantes.length>0 ? mrr/pagantes.length : 0
        const totalUsers = users.length
        const blockedUsers = users.filter((u:any)=>u.blocked).length
        const vencidas = companies.filter((c:any)=>c.plan_expires && c.plan_expires < hoje && c.plan!=='trial')
        const vencendo = companies.filter((c:any)=>c.plan_expires && c.plan_expires >= hoje && c.plan_expires <= em7dias)
        const ultimos = [...companies].sort((a:any,b:any)=>(b.created_at||'').localeCompare(a.created_at||'')).slice(0,5)
        // Ranking de módulos mais liberados
        const modCount: Record<string,number> = {}
        modStats.forEach((m:any)=>{ modCount[m.module_id] = (modCount[m.module_id]||0)+1 })
        const modRank = Object.entries(modCount).map(([id,n])=>({
          id, n, label: (allModules.find((am:any)=>am.id===id)?.label)||id,
          icon: (allModules.find((am:any)=>am.id===id)?.icon)||'📦'
        })).sort((a,b)=>b.n-a.n).slice(0,8)

        const Card = ({label,value,sub,color}:any) => (
          <div className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div style={{fontSize:'9px',color:'var(--t3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px'}}>{label}</div>
            <div style={{fontSize:'22px',fontWeight:800,color:color||'var(--t1)',marginTop:'2px'}}>{value}</div>
            {sub && <div style={{fontSize:'10px',color:'var(--t3)',marginTop:'2px'}}>{sub}</div>}
          </div>
        )

        return (
          <div className="flex flex-col gap-3">
            <SH label="📈 Visão Geral do SaaS" />

            {/* KPIs principais */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <Card label="Receita Mensal (MRR)" value={`R$ ${mrr.toLocaleString('pt-BR')}`} sub={`ARR: R$ ${arr.toLocaleString('pt-BR')}/ano`} color="var(--gn)" />
              <Card label="Ticket Médio" value={`R$ ${ticket.toLocaleString('pt-BR',{maximumFractionDigits:0})}`} sub={`${pagantes.length} empresa(s) pagante(s)`} color="var(--cy)" />
              <Card label="Empresas" value={companies.length} sub={`${ativas.length} ativas · ${inativas.length} inativas`} />
              <Card label="Em Trial" value={trials.length} sub="período de teste" color="var(--am)" />
              <Card label="Usuários" value={totalUsers} sub={`${blockedUsers} bloqueado(s)`} />
              <Card label="Vencidas" value={vencidas.length} sub={vencidas.length>0?'⚠️ requer atenção':'tudo em dia'} color={vencidas.length>0?'var(--rd)':'var(--gn)'} />
            </div>

            {/* Alertas de vencimento */}
            {(vencidas.length>0 || vencendo.length>0) && (
              <div className="rounded-xl p-3" style={{background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.25)'}}>
                <div style={{fontSize:'11px',fontWeight:800,color:'var(--rd)',marginBottom:'6px'}}>🔔 Alertas de Assinatura</div>
                {vencidas.map((c:any)=>(
                  <div key={c.id} style={{fontSize:'11px',color:'var(--t2)',marginBottom:'3px'}}>
                    🔴 <b>{c.name}</b> — plano {c.plan} venceu em {fmtD(c.plan_expires)}
                  </div>
                ))}
                {vencendo.map((c:any)=>(
                  <div key={c.id} style={{fontSize:'11px',color:'var(--t2)',marginBottom:'3px'}}>
                    🟡 <b>{c.name}</b> — vence em {fmtD(c.plan_expires)}
                  </div>
                ))}
              </div>
            )}

            {/* Módulos mais liberados */}
            <div className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div style={{fontSize:'11px',fontWeight:800,color:'var(--t2)',marginBottom:'8px'}}>📦 Módulos mais liberados</div>
              {modRank.length===0 ? (
                <div style={{fontSize:'10px',color:'var(--t3)'}}>Nenhuma empresa com módulos configurados ainda.</div>
              ) : modRank.map((m:any)=>{
                const pct = ativas.length>0 ? Math.round(m.n/companies.length*100) : 0
                return (
                  <div key={m.id} style={{marginBottom:'6px'}}>
                    <div className="flex justify-between" style={{fontSize:'10px',marginBottom:'2px'}}>
                      <span>{m.icon} {m.label}</span>
                      <span style={{color:'var(--t3)'}}>{m.n} empresa(s)</span>
                    </div>
                    <div style={{height:'5px',background:'var(--s2)',borderRadius:'3px',overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:'var(--cy)',borderRadius:'3px'}} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Últimos cadastros */}
            <div className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div style={{fontSize:'11px',fontWeight:800,color:'var(--t2)',marginBottom:'8px'}}>🆕 Últimos cadastros</div>
              {ultimos.length===0 ? (
                <div style={{fontSize:'10px',color:'var(--t3)'}}>Nenhuma empresa cadastrada.</div>
              ) : ultimos.map((c:any)=>(
                <div key={c.id} className="flex justify-between items-center" style={{fontSize:'11px',padding:'4px 0',borderTop:'1px solid var(--bd)'}}>
                  <span><b>{c.name}</b> <span style={{color:'var(--t3)'}}>· {c.plan}</span></span>
                  <span style={{color:'var(--t3)',fontSize:'10px'}}>{fmtD(c.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {tab==='companies' && (
        <>
          <SH label={`Empresas (${companies.length})`} action={<Btn onClick={()=>{setEdit({plan:'trial'});setCompanyMods(new Set());setModal(true)}} size="sm" variant="primary">+ Nova Empresa</Btn>} />
          {loading?<div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div>:
          companies.length===0?<Empty icon="🏭" text="Nenhuma empresa cadastrada"/>:(
            <div className="flex flex-col gap-2">
              {companies.map(c=>{
                const s = stats[c.id]||{}
                const isExpired = c.plan==='trial'&&c.plan_expires&&c.plan_expires<td()
                return (
                  <div key={c.id} className="p-3 rounded-xl" style={{background:'var(--s1)',border:`1px solid ${!c.active||isExpired?'rgba(239,68,68,.4)':'var(--bd)'}`}}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="text-sm font-bold">{c.name}</div>
                          <Badge color={PLAN_COLORS[c.plan] as any}>{c.plan}</Badge>
                          {!c.active&&<Badge color="red">Suspensa</Badge>}
                          {isExpired&&<Badge color="red">Trial expirado</Badge>}
                        </div>
                        <div className="text-xs mt-0.5 font-mono" style={{color:'var(--t3)'}}>/{c.slug}</div>
                        <div className="text-xs mt-1" style={{color:'var(--am)',fontWeight:700}}>{PLAN_PRICES[c.plan]}</div>
                        <div className="flex gap-3 mt-1 text-xs" style={{color:'var(--t2)'}}>
                          <span>👥 {s.users||0} usuários</span>
                          <span>📋 {s.osTotal||0} OS</span>
                          {c.plan_expires&&<span>📅 Expira: {fmtD(c.plan_expires)}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={()=>abrirEmpresa(c)} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>
                        <button onClick={()=>toggleCompany(c)} style={{background:'none',border:'none',color:c.active?'var(--am)':'var(--gn)',cursor:'pointer',fontSize:'14px'}}>{c.active?'⏸️':'▶️'}</button>
                        <button onClick={()=>delCompany(c.id)} style={{background:'none',border:'none',color:'var(--rd)',cursor:'pointer',fontSize:'12px'}}>🗑️</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab==='users' && (
        <>
          <SH label={`Administradores / Usuários (${users.length})`} action={<Btn onClick={()=>{setNewUser({role:'admin'});setUserModal(true)}} size="sm" variant="primary">+ Criar admin</Btn>} />
          <div style={{fontSize:'10px',color:'var(--t3)',marginBottom:'10px',lineHeight:1.5}}>
            Aqui você cria o <b style={{color:'var(--t2)'}}>administrador</b> de cada empresa (perfil Administrador). Depois, cada admin acessa o próprio sistema e cadastra os usuários da empresa dele.
          </div>
          {users.length===0?<Empty icon="👤" text="Nenhum usuário"/>:(
            <div className="flex flex-col gap-2">
              {users.map((u:any)=>(
                <div key={u.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold" style={{background:'rgba(0,212,255,.15)',color:'var(--cy)',flexShrink:0}}>
                    {(u.display_name||u.email||'?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold">{u.display_name||u.email}</div>
                    <div className="text-xs" style={{color:'var(--t2)'}}>@{(u.email||"").split("@")[0]}</div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>🏭 {(u as any).companies?.name||'—'} · {u.role}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={u.blocked?'red':'green'}>{u.blocked?'Bloqueado':'Ativo'}</Badge>
                    {u.blocked && (
                      <Btn onClick={()=>desbloquearUsuario(u)} size="sm" variant="primary">🔓 Desbloquear</Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CARGOS / SETORES: quais abas cada um libera ── */}
      {tab==='permissoes' && (
        <>
          <div style={{fontSize:'11px',color:'var(--t3)',marginBottom:'12px'}}>
            Crie cargos/setores e escolha quais abas cada um libera no sistema. Vale para todas as empresas.
            A mudança aparece na próxima vez que o usuário abrir o sistema.
          </div>

          {/* Criar novo cargo/setor */}
          <div className="rounded-2xl p-3 mb-3" style={{background:'var(--s2)',border:'1px dashed var(--bd2)'}}>
            <div className="text-xs font-bold mb-2" style={{color:'var(--cy)'}}>➕ Novo cargo / setor</div>
            <div className="flex gap-2 items-center">
              <input value={novoCargo} onChange={e=>setNovoCargo(e.target.value)} placeholder="Ex.: Mecânico, Conferente, Portaria…"
                style={{flex:1,background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:'10px',padding:'9px 12px',color:'var(--t1)',fontFamily:'Sora,system-ui',fontSize:'13px',outline:'none'}} />
              <Btn onClick={criarCargo} size="md" variant="primary">Criar</Btn>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {cargos.map(c => {
              const sel = roleMods[c.role] || new Set<string>()
              const tudo = sel.has('*')
              return (
                <div key={c.role} className="rounded-2xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <input value={c.label||''} onChange={e=>setLabel(c.role,e.target.value)} placeholder={c.role}
                      style={{flex:1,minWidth:0,background:'transparent',border:'none',borderBottom:'1px solid var(--bd)',color:'var(--cy)',fontFamily:'Sora,system-ui',fontSize:'13px',fontWeight:700,outline:'none',padding:'2px 0'}} />
                    <div className="flex gap-2 items-center" style={{flexShrink:0}}>
                      <button onClick={()=>toggleRoleAll(c.role,true)}
                        style={{fontSize:'10px',color:tudo?'#f97316':'var(--t3)',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>Todas</button>
                      <button onClick={()=>toggleRoleAll(c.role,false)}
                        style={{fontSize:'10px',color:'var(--rd)',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>Nenhuma</button>
                      <Btn onClick={()=>salvarRoleMods(c.role)} size="sm" variant="primary" disabled={savingRole===c.role}>
                        {savingRole===c.role?'…':'Salvar'}
                      </Btn>
                      {!c.protegido && (
                        <button onClick={()=>excluirCargo(c)} title="Excluir cargo"
                          style={{fontSize:'14px',background:'none',border:'none',cursor:'pointer',color:'var(--rd)'}}>🗑️</button>
                      )}
                    </div>
                  </div>
                  {tudo ? (
                    <div style={{fontSize:'11px',color:'var(--gn)',fontWeight:600}}>✅ Vê todas as abas</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {allModules.filter((m:any)=>m.id!=='superadmin').map((m:any)=>{
                        const on = sel.has(m.id)
                        return (
                          <div key={m.id} onClick={()=>toggleRoleMod(c.role,m.id)}
                            style={{fontSize:'10px',fontWeight:700,padding:'4px 9px',borderRadius:'999px',cursor:'pointer',
                              background:on?'rgba(249,115,22,.14)':'var(--s2)',
                              border:`1px solid ${on?'rgba(249,115,22,.45)':'var(--bd)'}`,
                              color:on?'#f97316':'var(--t3)'}}>
                            {on?'✓ ':''}{m.icon} {m.label}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {cargos.length===0 && <Empty icon="🔐" text="Nenhum cargo ainda. Rode o SQL ou crie um acima." />}
          </div>
        </>
      )}

      {/* Company Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Empresa':'Nova Empresa Cliente'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveCompany} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Nome da Empresa *" value={editing.name} onChange={(v:string)=>setEdit((e:any)=>({...e,name:v,slug:v.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}))} placeholder="Laminadora ABC Ltda." />
        <Input label="Slug (URL)" value={editing.slug} onChange={(v:string)=>setEdit((e:any)=>({...e,slug:v}))} placeholder="laminadora-abc" />
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Plano *" value={editing.plan||'trial'} onChange={(v:string)=>setEdit((e:any)=>({...e,plan:v}))} options={PLANS} />
          <Input label="Expira em" value={editing.plan_expires} onChange={(v:string)=>setEdit((e:any)=>({...e,plan_expires:v}))} type="date" />
          <Input label="Limite de usuários" value={editing.max_users} onChange={(v:string)=>setEdit((e:any)=>({...e,max_users:v}))} type="number" placeholder="5" />
          <Input label="CNPJ" value={editing.cnpj} onChange={(v:string)=>setEdit((e:any)=>({...e,cnpj:v}))} placeholder="00.000.000/0001-00" />
          <Input label="Telefone" value={editing.phone} onChange={(v:string)=>setEdit((e:any)=>({...e,phone:v}))} type="tel" />
        </div>
        <Input label="E-mail de contato" value={editing.email} onChange={(v:string)=>setEdit((e:any)=>({...e,email:v}))} type="email" />
        {/* Plan pricing info */}
        {editing.plan && editing.plan !== 'trial' && (
          <div className="rounded-xl p-2.5" style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.25)'}}>
            <div className="text-xs font-bold" style={{color:'var(--gn)'}}>💰 Receita: {PLAN_PRICES[editing.plan]}</div>
          </div>
        )}

        {/* Módulos liberados para a empresa */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold" style={{color:'var(--t2)'}}>📦 Módulos liberados ({companyMods.size}/{allModules.length})</span>
            <div className="flex gap-1">
              <button onClick={()=>setCompanyMods(new Set(allModules.map((m:any)=>m.id)))}
                style={{fontSize:'10px',color:'var(--cy)',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>Todos</button>
              <span style={{color:'var(--t3)'}}>·</span>
              <button onClick={()=>setCompanyMods(new Set())}
                style={{fontSize:'10px',color:'var(--rd)',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>Nenhum</button>
            </div>
          </div>
          <div style={{maxHeight:'220px',overflowY:'auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px'}}>
            {allModules.map((m:any) => {
              const on = companyMods.has(m.id)
              return (
                <div key={m.id} onClick={()=>toggleModulo(m.id)}
                  style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 8px',borderRadius:'8px',cursor:'pointer',fontSize:'11px',
                    background: on ? 'rgba(249,115,22,.12)' : 'var(--s2)',
                    border: `1px solid ${on ? 'rgba(249,115,22,.4)' : 'var(--bd)'}`,
                    color: on ? '#f97316' : 'var(--t3)', fontWeight: on ? 700 : 400}}>
                  <span>{on ? '☑️' : '⬜'}</span>
                  <span>{m.icon} {m.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* Invite User Modal */}
      <Modal open={userModal} onClose={()=>setUserModal(false)} title="Criar administrador da empresa"
        footer={<><Btn onClick={()=>setUserModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={inviteUser} variant="primary" size="md">Criar acesso</Btn></>}>
        <div className="rounded-xl p-3 mb-3" style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)'}}>
          <div className="text-xs font-bold mb-1" style={{color:'var(--cy)'}}>ℹ️ Como funciona</div>
          <div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>Crie o <b>Administrador</b> da empresa com usuário e senha. Ele acessa o sistema e cadastra os próprios usuários. O acesso já fica vinculado à empresa escolhida — sem e-mail.</div>
        </div>
        <Input label="Nome de Usuário *" value={newUser.username} onChange={(v:string)=>setNewUser((e:any)=>({...e,username:v.toLowerCase().replace(/[^a-z0-9._-]/g,'')}))} placeholder="ex: joao.silva" />
        <Input label="Senha *" value={newUser.password} onChange={(v:string)=>setNewUser((e:any)=>({...e,password:v}))} type="password" placeholder="mínimo 6 caracteres" />
        <Input label="Nome Completo" value={newUser.display_name} onChange={(v:string)=>setNewUser((e:any)=>({...e,display_name:v}))} placeholder="Nome completo" />
        <Select label="Empresa *" value={newUser.company_id} onChange={(v:string)=>setNewUser((e:any)=>({...e,company_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...companies.map(c=>({value:c.id,label:c.name}))]} />
        <Select label="Perfil / Cargo" value={newUser.role||'admin'} onChange={(v:string)=>setNewUser((e:any)=>({...e,role:v}))}
          options={cargos.length>0 ? cargos.map((c:any)=>({value:c.role,label:c.label||c.role})) : [{value:'admin',label:'Administrador'},{value:'supervisor',label:'Supervisor'},{value:'operator',label:'Operador'},{value:'viewer',label:'Consulta'}]} />
      </Modal>
    </div>
  )
}
