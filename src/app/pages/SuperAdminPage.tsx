'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'

const INTERNAL_DOMAIN = 'industrial8.local'
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

export default function SuperAdminPage({ profile }: Props) {
  const [companies, setCompanies] = useState<any[]>([])
  const [users, setUsers]         = useState<any[]>([])
  const [stats, setStats]         = useState<any>({})
  const [loading, setLoad]        = useState(true)
  const [modal, setModal]         = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [editing, setEdit]        = useState<any>({})
  const [newUser, setNewUser]     = useState<any>({})
  const [tab, setTab]             = useState('companies')
  const { confirm, dialog }       = useConfirm()

  useEffect(() => { load() }, [tab])

  async function load() {
    if (tab === 'companies') {
      const { data } = await supabase.from('companies').select('*').order('created_at', {ascending:false})
      setCompanies(data||[])
      // Get stats per company
      const companyIds = (data||[]).map((c:any)=>c.id)
      if (companyIds.length > 0) {
        const [profs, os] = await Promise.all([
          supabase.from('profiles').select('company_id').in('company_id', companyIds),
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
    } else {
      const { data } = await supabase.from('profiles').select('*,companies(name)').order('created_at',{ascending:false})
      setUsers(data||[])
    }
    setLoad(false)
  }

  async function saveCompany() {
    if (!editing.name) { toast.error('Informe o nome da empresa'); return }
    if (!editing.slug) { editing.slug = editing.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') }
    try {
      if (editing.id) {
        await supabase.from('companies').update(editing).eq('id', editing.id)
        toast.success('Empresa atualizada ✅')
      } else {
        const { error } = await supabase.from('companies').insert({ ...editing, active:true, plan: editing.plan||'trial', plan_expires: editing.plan_expires || new Date(Date.now()+30*86400000).toISOString().split('T')[0] })
        if (error) throw error
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
        {[{k:'companies',l:'🏭 Empresas'},{k:'users',l:'👥 Usuários'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='companies' && (
        <>
          <SH label={`Empresas (${companies.length})`} action={<Btn onClick={()=>{setEdit({plan:'trial'});setModal(true)}} size="sm" variant="primary">+ Nova Empresa</Btn>} />
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
                        <button onClick={()=>{setEdit({...c});setModal(true)}} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>
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
          <SH label={`Usuários (${users.length})`} action={<Btn onClick={()=>setUserModal(true)} size="sm" variant="primary">+ Convidar</Btn>} />
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
                  <Badge color={u.blocked?'red':'green'}>{u.blocked?'Bloqueado':'Ativo'}</Badge>
                </div>
              ))}
            </div>
          )}
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
      </Modal>

      {/* Invite User Modal */}
      <Modal open={userModal} onClose={()=>setUserModal(false)} title="Convidar Usuário"
        footer={<><Btn onClick={()=>setUserModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={inviteUser} variant="primary" size="md">Enviar Convite</Btn></>}>
        <div className="rounded-xl p-3 mb-3" style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)'}}>
          <div className="text-xs font-bold mb-1" style={{color:'var(--cy)'}}>ℹ️ Como funciona</div>
          <div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>Defina usuário e senha. O acesso já fica vinculado à empresa selecionada — sem necessidade de e-mail.</div>
        </div>
        <Input label="Nome de Usuário *" value={newUser.username} onChange={(v:string)=>setNewUser((e:any)=>({...e,username:v.toLowerCase().replace(/[^a-z0-9._-]/g,'')}))} placeholder="ex: joao.silva" />
        <Input label="Senha *" value={newUser.password} onChange={(v:string)=>setNewUser((e:any)=>({...e,password:v}))} type="password" placeholder="mínimo 6 caracteres" />
        <Input label="Nome Completo" value={newUser.display_name} onChange={(v:string)=>setNewUser((e:any)=>({...e,display_name:v}))} placeholder="Nome completo" />
        <Select label="Empresa *" value={newUser.company_id} onChange={(v:string)=>setNewUser((e:any)=>({...e,company_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...companies.map(c=>({value:c.id,label:c.name}))]} />
        <Select label="Perfil" value={newUser.role||'operator'} onChange={(v:string)=>setNewUser((e:any)=>({...e,role:v}))}
          options={[{value:'admin',label:'Administrador'},{value:'supervisor',label:'Supervisor'},{value:'operator',label:'Operador'},{value:'viewer',label:'Consulta'}]} />
      </Modal>
    </div>
  )
}
