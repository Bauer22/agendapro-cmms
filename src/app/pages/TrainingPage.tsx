'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
export default function TrainingPage({ profile, can }: Props) {
  const [trainings, setTrainings] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); supabase.from('profiles').select('id,display_name,email').then(({data})=>setUsers((data||[]).map((x:any)=>({...x,display_name:x.display_name||x.email?.split('@')[0]})))) }, [])

  async function load() {
    const { data, error } = await supabase.from('trainings').select('*').order('training_date',{ascending:false})
    if (error) toast.error(error.message)
    setTrainings(data||[]); setLoading(false)
  }

  async function save() {
    if (!editing.title||!editing.user_id) { toast.error('Informe título e funcionário'); return }
    const obj = { title:editing.title, category:editing.category||'Interno', user_id:editing.user_id, user_name:users.find(u=>u.id===editing.user_id)?.display_name||'', training_date:editing.training_date||td(), expiry_date:editing.expiry_date||null, instructor:editing.instructor, hours:parseFloat(editing.hours)||0, status:editing.status||'scheduled', notes:editing.notes, certificate_url:editing.certificate_url, created_by:profile?.display_name }
    const { error } = editing.id ? await supabase.from('trainings').update(obj).eq('id',editing.id) : await supabase.from('trainings').insert(obj)
    if (error) { toast.error(error.message); return }
    toast.success('Treinamento salvo ✅'); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir treinamento?')) return
    const { error } = await supabase.from('trainings').delete().eq('id',id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído'); load()
  }

  const STATUS_C: Record<string,string> = {scheduled:'blue',completed:'green',expired:'red',cancelled:'gray'}

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="🎓 Treinamentos" action={<Btn onClick={()=>{setEditing({status:'scheduled',category:'Interno',training_date:td()});setModal(true)}} variant="primary" size="sm">+ Novo</Btn>} />

      {loading ? <Empty icon="⏳" text="Carregando..." /> : trainings.length===0 ? <Empty icon="🎓" text="Nenhum treinamento cadastrado." /> : (
        <div className="flex flex-col gap-2">
          {trainings.map(t=>{
            const expired = t.expiry_date && new Date(t.expiry_date) < new Date() && t.status !== 'cancelled'
            return (
              <div key={t.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:`1px solid ${expired?'rgba(239,68,68,.4)':'var(--bd)'}`}}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge color={expired?'red':STATUS_C[t.status]||'gray'}>{expired?'⚠️ Vencido':t.status==='scheduled'?'📅 Agendado':t.status==='completed'?'✅ Concluído':'❌ Cancelado'}</Badge>
                      <Badge color="purple">{t.category}</Badge>
                    </div>
                    <div className="font-bold text-sm">{t.title}</div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>👤 {t.user_name}{t.instructor?' · Instrutor: '+t.instructor:''}{t.hours?' · '+t.hours+'h':''}</div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>📅 {fmtD(t.training_date)}{t.expiry_date?' · Validade: '+fmtD(t.expiry_date):''}</div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Btn onClick={()=>{setEditing(t);setModal(true)}} size="sm">✏️</Btn>
                    <Btn onClick={()=>del(t.id)} variant="danger" size="sm">🗑</Btn>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Treinamento':'Novo Treinamento'}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Título do treinamento *" value={editing.title} onChange={(v:string)=>setEditing((e:any)=>({...e,title:v}))} placeholder="Ex: NR-10 Segurança Elétrica" />
        <div className="grid grid-cols-2 gap-x-3">
          <Select label="Categoria" value={editing.category||'Interno'} onChange={(v:string)=>setEditing((e:any)=>({...e,category:v}))} options={['Interno','Externo','NR','ABNT','Online','Outro']} />
          <Select label="Status" value={editing.status||'scheduled'} onChange={(v:string)=>setEditing((e:any)=>({...e,status:v}))} options={[{value:'scheduled',label:'📅 Agendado'},{value:'completed',label:'✅ Concluído'},{value:'cancelled',label:'❌ Cancelado'}]} />
        </div>
        <Select label="Funcionário *" value={editing.user_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,user_id:v}))} options={[{value:'',label:'Selecione...'}, ...users.map(u=>({value:u.id,label:u.display_name}))]} />
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data" value={editing.training_date} onChange={(v:string)=>setEditing((e:any)=>({...e,training_date:v}))} type="date" />
          <Input label="Carga horária (h)" value={editing.hours} onChange={(v:string)=>setEditing((e:any)=>({...e,hours:v}))} type="number" placeholder="8" />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Validade" value={editing.expiry_date} onChange={(v:string)=>setEditing((e:any)=>({...e,expiry_date:v}))} type="date" />
          <Input label="Instrutor" value={editing.instructor} onChange={(v:string)=>setEditing((e:any)=>({...e,instructor:v}))} placeholder="Nome do instrutor" />
        </div>
        <Input label="Link do certificado" value={editing.certificate_url} onChange={(v:string)=>setEditing((e:any)=>({...e,certificate_url:v}))} type="url" placeholder="https://..." />
      </Modal>
    </div>
  )
}
