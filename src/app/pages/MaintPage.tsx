'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Maintenance, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const TYPES = ['Preventiva','Corretiva','Preditiva','Lubrificação','Troca de óleo','Troca de peça','Inspeção','Calibração','Limpeza','Outro']
const RESULTS = [{value:'ok',label:'✅ Normalizado'},{value:'monitoring',label:'👁️ Monitorando'},{value:'pending',label:'⏳ Ag. peça'},{value:'stopped',label:'🔴 Parado'}]
const RESULT_LABELS: Record<string,string> = {ok:'✅ Normalizado',monitoring:'👁️ Monitorando',pending:'⏳ Ag. peça',stopped:'🔴 Parado'}

export default function MaintPage({ profile, can }: Props) {
  const [recs, setRecs]     = useState<Maintenance[]>([])
  const [machines, setMach] = useState<any[]>([])
  const [loading, setLoad]  = useState(true)
  const [modal, setModal]   = useState(false)
  const [editing, setEdit]  = useState<Partial<Maintenance>>({})
  const [fMach, setFMach]   = useState('')
  const [fType, setFType]   = useState('')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const [r, m] = await Promise.all([
      supabase.from('maintenance').select('*').order('date',{ascending:false}).limit(100),
      supabase.from('machines').select('id,name,icon,code'),
    ])
    setRecs(r.data||[]); setMach(m.data||[]); setLoad(false)
  }

  function openNew(machineId?: string) {
    setEdit({ date: td(), result:'ok', type:'Preventiva', machine_id: machineId, resp: profile?.display_name||'' })
    setModal(true)
  }

  async function save() {
    if (!editing.machine_id) { toast.error('Selecione a máquina'); return }
    if (!editing.resp)       { toast.error('Informe o responsável'); return }
    const mach = machines.find(m=>m.id===editing.machine_id)
    const obj = { ...editing, machine_name: mach?.name, created_by: profile?.display_name||profile?.email }
    try {
      if (editing.id) {
        const { error } = await supabase.from('maintenance').update(obj).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('maintenance').insert({ ...obj, created_at: new Date().toISOString() })
        if (error) throw error
        // Update oil date if oil change
        if (editing.type === 'Troca de óleo' && mach?.category === 'transport') {
          const machFull = await supabase.from('machines').select('current_hours').eq('id', editing.machine_id).single()
          if (machFull.data) await supabase.from('machines').update({ last_oil_hours: machFull.data.current_hours, last_oil_date: editing.date }).eq('id', editing.machine_id)
        }
      }
      toast.success('Manutenção registrada ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir este registro?')) return
    await supabase.from('maintenance').delete().eq('id', id)
    toast.success('Excluído'); load()
  }

  const filtered = recs.filter(r => (!fMach||r.machine_id===fMach) && (!fType||r.type===fType))

  return (
    <div>
      {dialog}
      <div className="flex gap-2 mb-2">
        <select value={fMach} onChange={e=>setFMach(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todas as máquinas</option>
          {machines.map(m=><option key={m.id} value={m.id}>{m.icon||'⚙️'} {m.name}</option>)}
        </select>
        <select value={fType} onChange={e=>setFType(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todos os tipos</option>
          {TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      <SH label={`Registros (${filtered.length})`} action={can('maint')&&<Btn onClick={()=>openNew()} size="sm" variant="primary">+ Registrar</Btn>} />

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : filtered.length===0 ? <Empty icon="🔧" text="Nenhum registro" /> : (
        <div className="flex flex-col gap-2">
          {filtered.map(r => {
            const mach = machines.find(m=>m.id===r.machine_id)
            return (
              <div key={r.id} className="flex items-start gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <span className="text-base flex-shrink-0 pt-0.5">{mach?.icon||'🔧'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{mach?.name||'Máquina'} — {r.type}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>👤 {r.resp} · 📅 {fmtD(r.date)}{r.duration&&` · ⏱️ ${r.duration}h`}</div>
                  {r.description && <div className="text-xs mt-1" style={{color:'var(--t3)'}}>{r.description.slice(0,80)}</div>}
                  <div className="text-xs mt-1">{RESULT_LABELS[r.result]||r.result}</div>
                </div>
                {can('maint') && <button onClick={()=>del(r.id)} className="text-sm" style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',flexShrink:0}}>🗑️</button>}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title="Registrar Manutenção"
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Máquina *" value={editing.machine_id} onChange={(v:string)=>setEdit(e=>({...e,machine_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Tipo *" value={editing.type} onChange={(v:string)=>setEdit(e=>({...e,type:v}))} options={TYPES} />
          <Input label="Data *" value={editing.date} onChange={(v:string)=>setEdit(e=>({...e,date:v}))} type="date" />
          <Input label="Responsável *" value={editing.resp} onChange={(v:string)=>setEdit(e=>({...e,resp:v}))} placeholder="Nome do técnico" />
          <Input label="Duração (h)" value={editing.duration} onChange={(v:string)=>setEdit(e=>({...e,duration:parseFloat(v)||undefined}))} type="number" placeholder="0.5" />
        </div>
        <Input label="Peças Utilizadas" value={editing.parts} onChange={(v:string)=>setEdit(e=>({...e,parts:v}))} placeholder="Ex: Filtro AR-001..." />
        <Textarea label="Descrição do serviço" value={editing.description} onChange={(v:string)=>setEdit(e=>({...e,description:v}))} rows={3} placeholder="Descreva o serviço..." />
        <Select label="Situação após" value={editing.result} onChange={(v:string)=>setEdit(e=>({...e,result:v}))} options={RESULTS} />
      </Modal>
    </div>
  )
}
