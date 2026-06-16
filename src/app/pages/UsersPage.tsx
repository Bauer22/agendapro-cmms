'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { ROLES } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

const INTERNAL_DOMAIN = 'industrial8-internal.com'
function usernameToEmail(u: string) {
  return `${(u||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@${INTERNAL_DOMAIN}`
}

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
const ROLE_LABELS: Record<string,string> = {
  superadmin: '🌐 Super Admin',
  admin:      '👑 Administrador',
  supervisor: '🛠️ Supervisor',
  operator:   '🔧 Operador',
  viewer:     '👁️ Consulta',
}
const ROLE_OPTS = Object.keys(ROLES).filter(k=>k!=='superadmin').map(k=>({value:k,label:ROLE_LABELS[k]||k}))
const SHIFTS = ['A','B','C','D','ADM']
const ROLE_COLORS: Record<string,string> = {superadmin:'orange',admin:'purple',supervisor:'amber',operator:'green',viewer:'gray'}

export default function UsersPage({ profile, can }: Props) {
  const [users, setUsers]   = useState<UserProfile[]>([])
  const [loading, setLoad]  = useState(true)
  const [modal, setModal]   = useState(false)
  const [editing, setEdit]  = useState<any>({})
  const [isNew, setIsNew]   = useState(false)
  const [saving, setSaving] = useState(false)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('display_name')
    setUsers(data||[]); setLoad(false)
  }

  function openNew() { setEdit({ role:'operator', shift:'A' }); setIsNew(true); setModal(true) }
  function openEdit(u: UserProfile) { setEdit({...u}); setIsNew(false); setModal(true) }

  async function save() {
    if (!editing.display_name) { toast.error('Informe o nome'); return }
    if (isNew) {
      if (!editing.username) { toast.error('Informe o nome de usuário'); return }
      if (!/^[a-z0-9._-]{3,}$/i.test(editing.username)) { toast.error('Usuário inválido (mín. 3 letras/números, sem espaços)'); return }
      if (!editing.password || editing.password.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres'); return }
    }
    setSaving(true)
    try {
      if (isNew) {
        // Chama rota server-side que usa Service Role Key (Admin API) —
        // cria o usuário SEM enviar e-mail e SEM afetar a sessão do admin
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: editing.username,
            password: editing.password,
            display_name: editing.display_name,
            role: editing.role || 'operator',
            company_id: profile?.company_id || null,
            shift: editing.shift,
            sector: editing.sector,
            code: editing.code,
          })
        })
        const result = await res.json()
        if (!res.ok) {
          toast.error('Erro: ' + (result.error || 'Falha ao criar usuário'))
          setSaving(false); return
        }
        toast.success(`Usuário "${result.username}" criado ✅`)
      } else {
        const { error } = await supabase.from('profiles').update({
          display_name: editing.display_name, role: editing.role,
          shift: editing.shift, sector: editing.sector, code: editing.code,
        }).eq('id', editing.id)
        if (error) throw error
        toast.success('Usuário atualizado ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
    setSaving(false)
  }

  async function resetPassword(u: UserProfile) {
    toast('Para alterar senha de outro usuário, acesse:\nSupabase → Authentication → Users → selecione o usuário → Reset Password', { duration:8000, icon:'ℹ️' })
  }

  async function toggleBlock(u: UserProfile) {
    const action = u.blocked ? 'desbloquear' : 'bloquear'
    if (!await confirm(`Deseja ${action} ${u.display_name||u.email}?`)) return
    const { error: eBl } = await supabase.from('profiles').update({ blocked: !u.blocked }).eq('id', u.id)
    if (eBl) { toast.error('Erro: '+eBl.message); return }
    toast.success(u.blocked ? 'Usuário desbloqueado' : 'Usuário bloqueado')
    load()
  }

  return (
    <div>
      {dialog}
      <div className="rounded-xl p-3 mb-3" style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)'}}>
        <div className="text-xs font-bold mb-1" style={{color:'var(--cy)'}}>ℹ️ Como adicionar usuários</div>
        <div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>
          1. Acesse o <strong>Supabase Dashboard</strong><br/>
          2. Vá em <strong>Authentication → Users → Invite user</strong><br/>
          3. O usuário recebe um e-mail para criar a senha<br/>
          4. Aqui você edita o nome, perfil e turno
        </div>
      </div>

      <SH label={`Usuários (${users.length})`} action={<Btn onClick={openNew} size="sm" variant="primary">+ Usuário</Btn>} />

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : users.length===0 ? <Empty icon="👤" text="Nenhum usuário" /> : (
        <div className="flex flex-col gap-2">
          {users.map(u => (
            <div key={u.id} className={`flex items-center gap-2 p-2.5 rounded-xl ${u.blocked?'opacity-50':''}`} style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{background:`rgba(${u.role==='admin'?'124,58,237':u.role==='supervisor'?'245,158,11':u.role==='operator'?'16,185,129':'107,114,128'},.2)`,
                  color:u.role==='admin'?'#a78bfa':u.role==='supervisor'?'var(--am)':u.role==='operator'?'var(--gn)':'var(--t3)'}}>
                {(u.display_name||u.email||'?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">{u.display_name||'Sem nome'}</div>
                <div className="text-xs" style={{color:'var(--t2)'}}>@{(u.email||"").split("@")[0]}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge color={ROLE_COLORS[u.role] as any}>{ROLE_LABELS[u.role]||u.role}</Badge>
                  {u.shift && <span className="text-xs" style={{color:'var(--t3)'}}>Turno {u.shift}</span>}
                  {u.blocked && <Badge color="red">Bloqueado</Badge>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={()=>openEdit(u)} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>
                {u.id !== profile?.id && (
                  <button onClick={()=>toggleBlock(u)} style={{background:'none',border:'none',color:u.blocked?'var(--gn)':'var(--am)',cursor:'pointer',fontSize:'14px'}}>
                    {u.blocked?'🔓':'🔒'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={isNew?'Novo Usuário':'Editar Usuário'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md" disabled={saving}>{saving?"Salvando...":"Salvar"}</Btn></>}>
        <Input label="Nome *" value={editing.display_name} onChange={(v:string)=>setEdit((e:any)=>({...e,display_name:v}))} placeholder="Nome completo" />
        {isNew && <>
          <Input label="Nome de Usuário *" value={editing.username} onChange={(v:string)=>setEdit((e:any)=>({...e,username:v.toLowerCase().replace(/[^a-z0-9._-]/g,'')}))} placeholder="ex: joao.silva" />
          <Input label="Senha *" value={editing.password} onChange={(v:string)=>setEdit((e:any)=>({...e,password:v}))} type="password" placeholder="mínimo 6 caracteres" />
        </>}
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Perfil *" value={editing.role} onChange={(v:string)=>setEdit((e:any)=>({...e,role:v}))} options={ROLE_OPTS} />
          <Select label="Turno" value={editing.shift} onChange={(v:string)=>setEdit((e:any)=>({...e,shift:v}))} options={SHIFTS} />
        </div>
        <Input label="Setor" value={editing.sector} onChange={(v:string)=>setEdit((e:any)=>({...e,sector:v}))} placeholder="Ex: Manutenção" />
        <Input label="Matrícula" value={editing.code} onChange={(v:string)=>setEdit((e:any)=>({...e,code:v}))} placeholder="00123" />
        {/* Permissions preview */}
        <div className="rounded-xl p-2.5 mt-1" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>
          <div className="text-xs font-bold mb-1.5" style={{color:'var(--t2)'}}>PERMISSÕES DESTE PERFIL</div>
          {editing.role && Object.entries({
            'Gerenciar OS': ROLES[editing.role]?.perms.includes('os')||ROLES[editing.role]?.perms.includes('all'),
            'Gerenciar Máquinas': ROLES[editing.role]?.perms.includes('mach')||ROLES[editing.role]?.perms.includes('all'),
            'Registrar Manutenção': ROLES[editing.role]?.perms.includes('maint')||ROLES[editing.role]?.perms.includes('all'),
            'Relatórios MP': ROLES[editing.role]?.perms.includes('pm')||ROLES[editing.role]?.perms.includes('all'),
            'Gerenciar Usuários': ROLES[editing.role]?.perms.includes('all'),
            'Acessar Relatórios': true,
          }).map(([k,v]) => (
            <div key={k} className="text-xs mb-1" style={{color:v?'var(--gn)':'var(--t3)'}}>{v?'✅':'❌'} {k}</div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
