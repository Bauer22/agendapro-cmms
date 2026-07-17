'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, useConfirm } from '@/components/ui'
import { td, fmtD } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
export default function OEEPage({ profile, can }: Props) {
  const [records, setRecords] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); supabase.from('machines').select('id,name,icon').then(({data})=>setMachines(data||[])) }, [])

  async function load() {
    const { data, error } = await supabase.from('oee_records').select('*').order('record_date',{ascending:false}).order('created_at',{ascending:false}).limit(100)
    if (error) toast.error(error.message)
    setRecords(data||[]); setLoading(false)
  }

  function calcOEE(r: any) {
    const avail = r.planned_time > 0 ? (r.operating_time / r.planned_time) * 100 : 0
    const perf  = r.operating_time > 0 ? (r.ideal_cycle_time * r.total_pieces / r.operating_time) * 100 : 0
    const qual  = r.total_pieces > 0 ? ((r.total_pieces - r.defect_pieces) / r.total_pieces) * 100 : 0
    const oee   = (avail / 100) * (perf / 100) * (qual / 100) * 100
    return { avail: avail.toFixed(1), perf: perf.toFixed(1), qual: qual.toFixed(1), oee: oee.toFixed(1) }
  }

  async function save() {
    if (!editing.machine_id||!editing.record_date) { toast.error('Selecione máquina e data'); return }
    const obj = { machine_id: editing.machine_id, machine_name: machines.find(m=>m.id===editing.machine_id)?.name||'', record_date: editing.record_date, shift: editing.shift||'A', planned_time: parseFloat(editing.planned_time)||0, operating_time: parseFloat(editing.operating_time)||0, ideal_cycle_time: parseFloat(editing.ideal_cycle_time)||0, total_pieces: parseInt(editing.total_pieces)||0, defect_pieces: parseInt(editing.defect_pieces)||0, notes: editing.notes, created_by: profile?.display_name }
    const { error } = editing.id ? await supabase.from('oee_records').update(obj).eq('id',editing.id) : await supabase.from('oee_records').insert(obj)
    if (error) { toast.error(error.message); return }
    toast.success('Registro salvo ✅'); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir registro?')) return
    const { error } = await supabase.from('oee_records').delete().eq('id',id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído'); load()
  }

  const avgOEE = records.length > 0 ? (records.reduce((s,r)=>s+parseFloat(calcOEE(r).oee),0)/records.length).toFixed(1) : '—'
  const avgAvail = records.length > 0 ? (records.reduce((s,r)=>s+parseFloat(calcOEE(r).avail),0)/records.length).toFixed(1) : '—'

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="📈 Indicadores OEE" action={<Btn onClick={()=>{setEditing({record_date:td(),shift:'A'});setModal(true)}} variant="primary" size="sm">+ Registrar</Btn>} />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <KPI num={`${avgOEE}%`} label="OEE Médio" color="orange" />
        <KPI num={`${avgAvail}%`} label="Disponib. Média" color="blue" />
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> : records.length===0 ? <Empty icon="📈" text="Nenhum registro de OEE ainda." /> : (
        <div className="flex flex-col gap-2">
          {records.map(r=>{
            const c = calcOEE(r)
            const oeeColor = parseFloat(c.oee)>=85?'#22c55e':parseFloat(c.oee)>=65?'#f59e0b':'#ef4444'
            return (
              <div key={r.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" style={{color:oeeColor}}>OEE: {c.oee}%</span>
                      <span className="text-xs" style={{color:'var(--t3)'}}>Turno {r.shift}</span>
                    </div>
                    <div className="font-semibold text-xs">{r.machine_name} · {fmtD(r.record_date)}</div>
                    <div className="text-xs mt-1 flex gap-3" style={{color:'var(--t2)'}}>
                      <span>⚙ Disp: {c.avail}%</span>
                      <span>🚀 Perf: {c.perf}%</span>
                      <span>✅ Qual: {c.qual}%</span>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Btn onClick={()=>{setEditing(r);setModal(true)}} size="sm">✏️</Btn>
                    <Btn onClick={()=>del(r.id)} variant="danger" size="sm">🗑</Btn>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title="Registro de OEE"
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Máquina *" value={editing.machine_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,machine_id:v}))} options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data *" value={editing.record_date} onChange={(v:string)=>setEditing((e:any)=>({...e,record_date:v}))} type="date" />
          <Select label="Turno" value={editing.shift||'A'} onChange={(v:string)=>setEditing((e:any)=>({...e,shift:v}))} options={['A','B','C','D']} />
        </div>
        <div style={{fontSize:'10px',fontWeight:700,color:'rgba(249,115,22,.7)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'4px',marginTop:'4px'}}>⏱ Tempos (minutos)</div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Tempo Planejado" value={editing.planned_time} onChange={(v:string)=>setEditing((e:any)=>({...e,planned_time:v}))} type="number" placeholder="480" />
          <Input label="Tempo Operando" value={editing.operating_time} onChange={(v:string)=>setEditing((e:any)=>({...e,operating_time:v}))} type="number" placeholder="440" />
        </div>
        <div style={{fontSize:'10px',fontWeight:700,color:'rgba(249,115,22,.7)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'4px'}}>📦 Produção</div>
        <div className="grid grid-cols-3 gap-x-2">
          <Input label="Tempo ciclo ideal (min)" value={editing.ideal_cycle_time} onChange={(v:string)=>setEditing((e:any)=>({...e,ideal_cycle_time:v}))} type="number" placeholder="0.5" />
          <Input label="Total peças" value={editing.total_pieces} onChange={(v:string)=>setEditing((e:any)=>({...e,total_pieces:v}))} type="number" placeholder="800" />
          <Input label="Peças com defeito" value={editing.defect_pieces} onChange={(v:string)=>setEditing((e:any)=>({...e,defect_pieces:v}))} type="number" placeholder="5" />
        </div>
        <Input label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} placeholder="Ocorrências do turno..." />
      </Modal>
    </div>
  )
}
