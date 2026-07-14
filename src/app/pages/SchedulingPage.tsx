'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { td, fmtD } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
export default function SchedulingPage({ profile, can }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); loadMeta() }, [])

  async function load() {
    const { data, error } = await supabase.from('scheduling').select('*').order('scheduled_date')
    if (error) toast.error('Erro: '+error.message)
    setItems(data||[]); setLoading(false)
  }

  async function loadMeta() {
    const [m, u] = await Promise.all([
      supabase.from('machines').select('id,name,icon'),
      supabase.from('profiles').select('id,display_name,email'),
    ])
    setMachines(m.data||[])
    setUsers((u.data||[]).map((x:any)=>({...x,display_name:x.display_name||x.email?.split('@')[0]})))
  }

  async function save() {
    if (!editing.machine_id||!editing.scheduled_date) { toast.error('Preencha máquina e data'); return }
    const obj = { machine_id: editing.machine_id, machine_name: machines.find(m=>m.id===editing.machine_id)?.name, scheduled_date: editing.scheduled_date, scheduled_time: editing.scheduled_time, type: editing.type||'Preventiva', description: editing.description, resp_id: editing.resp_id, resp_name: users.find(u=>u.id===editing.resp_id)?.display_name||'', status: editing.status||'pending', created_by: profile?.display_name }
    const { error } = editing.id ? await supabase.from('scheduling').update(obj).eq('id',editing.id) : await supabase.from('scheduling').insert(obj)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success(editing.id?'Atualizado ✅':'Agendado ✅'); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir agendamento?')) return
    const { error } = await supabase.from('scheduling').delete().eq('id',id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Excluído'); load()
  }

  const STATUS_C: Record<string,string> = {pending:'amber',confirmed:'blue',done:'green',cancelled:'gray'}
  const today = td()

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="📅 Agendamentos" action={<Btn onClick={()=>{setEditing({scheduled_date:today,status:'pending'});setModal(true)}} variant="primary" size="sm">+ Novo</Btn>} />

      {loading ? <Empty icon="⏳" text="Carregando..." /> : items.length===0 ? <Empty icon="📅" text="Nenhum agendamento. Agende a primeira intervenção!" /> : (
        <div className="flex flex-col gap-2 mt-2">
          {items.map(it=>(
            <div key={it.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color={STATUS_C[it.status]||'gray'}>{it.status==='pending'?'⏳ Pendente':it.status==='confirmed'?'✔ Confirmado':it.status==='done'?'✅ Realizado':'❌ Cancelado'}</Badge>
                    <Badge color="orange">{it.type||'Manutenção'}</Badge>
                  </div>
                  <div className="font-bold text-sm">{it.machine_name}</div>
                  {it.description&&<div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>{it.description}</div>}
                  <div className="text-xs mt-1" style={{color:'var(--t3)'}}>📅 {fmtD(it.scheduled_date)}{it.scheduled_time?' às '+it.scheduled_time:''}{it.resp_name?' · 👤 '+it.resp_name:''}</div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Btn onClick={()=>{setEditing(it);setModal(true)}} size="sm">✏️</Btn>
                  <Btn onClick={()=>del(it.id)} variant="danger" size="sm">🗑</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Agendamento':'Novo Agendamento'}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Máquina *" value={editing.machine_id} onChange={(v:string)=>setEditing((e:any)=>({...e,machine_id:v}))} options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <Select label="Tipo" value={editing.type||'Preventiva'} onChange={(v:string)=>setEditing((e:any)=>({...e,type:v}))} options={['Preventiva','Corretiva','Inspeção','Lubrificação','Calibração','Outro']} />
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data *" value={editing.scheduled_date} onChange={(v:string)=>setEditing((e:any)=>({...e,scheduled_date:v}))} type="date" />
          <Input label="Horário" value={editing.scheduled_time} onChange={(v:string)=>setEditing((e:any)=>({...e,scheduled_time:v}))} type="time" />
        </div>
        <Select label="Responsável" value={editing.resp_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,resp_id:v}))} options={[{value:'',label:'Selecione...'}, ...users.map(u=>({value:u.id,label:u.display_name}))]} />
        <Select label="Status" value={editing.status||'pending'} onChange={(v:string)=>setEditing((e:any)=>({...e,status:v}))} options={[{value:'pending',label:'⏳ Pendente'},{value:'confirmed',label:'✔ Confirmado'},{value:'done',label:'✅ Realizado'},{value:'cancelled',label:'❌ Cancelado'}]} />
        <Input label="Descrição" value={editing.description} onChange={(v:string)=>setEditing((e:any)=>({...e,description:v}))} placeholder="O que será feito?" />
      </Modal>
    </div>
  )
}
