'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, useConfirm } from '@/components/ui'
import { fmtD, td, PERIOD_LABEL } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const STATUS_OPTS = [{value:'ok',label:'✅ Conforme'},{value:'partial',label:'⚠️ Parcialmente'},{value:'nok',label:'❌ Não conforme'}]
const STATUS_COLORS: Record<string,string> = {ok:'var(--gn)',partial:'var(--am)',nok:'var(--rd)'}
const STATUS_LABELS: Record<string,string> = {ok:'✅ Conforme',partial:'⚠️ Parcialmente',nok:'❌ Não conforme'}

export default function PMPage({ profile, can }: Props) {
  const [recs, setRecs]       = useState<any[]>([])
  const [machines, setMach]   = useState<any[]>([])
  const [loading, setLoad]    = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEdit]    = useState<any>({})
  const [checklist, setChecklist] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<number,boolean>>({})
  const [fMach, setFMach]     = useState('')
  const [fPeriod, setFPeriod] = useState('')
  const { confirm, dialog }   = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const [r, m] = await Promise.all([
      supabase.from('pm_reports').select('*').order('date',{ascending:false}).limit(100),
      supabase.from('machines').select('id,name,icon,pm_plan,current_hours'),
    ])
    setRecs(r.data||[]); setMach(m.data||[]); setLoad(false)
  }

  function openNew() {
    setEdit({ date: td(), status:'ok', operator: profile?.display_name||'', period:'monthly' })
    setChecklist([]); setChecked({})
    setModal(true)
  }

  function loadChecklist(machineId: string, period: string) {
    const mach = machines.find(m=>m.id===machineId)
    const tasks = (mach?.pm_plan||[]).filter((p:any)=>p.period===period).map((p:any)=>p.task)
    setChecklist(tasks); setChecked({})
  }

  async function save() {
    if (!editing.machine_id) { toast.error('Selecione a máquina'); return }
    if (!editing.operator)   { toast.error('Informe o operador'); return }
    const mach = machines.find(m=>m.id===editing.machine_id)
    const obj = {
      ...editing,
      machine_name: mach?.name,
      checklist: checklist.reduce((acc:any,t:string,i:number)=>({...acc,[i]:!!checked[i]}),{}),
      created_by: profile?.display_name||profile?.email,
      created_at: new Date().toISOString(),
    }
    try {
      const { error } = await supabase.from('pm_reports').insert(obj)
      if (error) throw error
      toast.success('Relatório MP salvo ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir este relatório?')) return
    await supabase.from('pm_reports').delete().eq('id', id)
    toast.success('Excluído'); load()
  }

  const filtered = recs.filter(r => (!fMach||r.machine_id===fMach) && (!fPeriod||r.period===fPeriod))

  return (
    <div>
      {dialog}
      <div className="flex gap-2 mb-2">
        <select value={fMach} onChange={e=>setFMach(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todas as máquinas</option>
          {machines.map(m=><option key={m.id} value={m.id}>{m.icon||'⚙️'} {m.name}</option>)}
        </select>
        <select value={fPeriod} onChange={e=>setFPeriod(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todos os períodos</option>
          {Object.entries(PERIOD_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <SH label={`Relatórios MP (${filtered.length})`} action={can('pm')&&<Btn onClick={openNew} size="sm" variant="primary">+ Preencher</Btn>} />

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : filtered.length===0 ? <Empty icon="📝" text="Nenhum relatório de MP" /> : (
        <div className="flex flex-col gap-2">
          {filtered.map(r => {
            const mach = machines.find(m=>m.id===r.machine_id)
            const ck = r.checklist||{}; const ok=Object.values(ck).filter(Boolean).length; const tt=Object.keys(ck).length
            return (
              <div key={r.id} className="flex items-start gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <span className="text-base flex-shrink-0 pt-0.5">{mach?.icon||'📝'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{mach?.name||'Máquina'} — {PERIOD_LABEL[r.period]||r.period}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>👤 {r.operator} · 📅 {fmtD(r.date)}{tt?` · ✅ ${ok}/${tt}`:''}{r.hours_reading?` · ⏱️ ${r.hours_reading}h`:''}</div>
                  <div className="text-xs mt-1" style={{color:STATUS_COLORS[r.status]||'var(--t3)'}}>{STATUS_LABELS[r.status]||r.status}</div>
                </div>
                {can('pm') && <button onClick={()=>del(r.id)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'14px',flexShrink:0}}>🗑️</button>}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title="Relatório de MP"
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Máquina *" value={editing.machine_id} onChange={(v:string)=>{setEdit((e:any)=>({...e,machine_id:v}));loadChecklist(v,editing.period||'monthly')}} options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} className="col-span-2" />
          <Select label="Período *" value={editing.period} onChange={(v:string)=>{setEdit((e:any)=>({...e,period:v}));loadChecklist(editing.machine_id||'',v)}}
            options={Object.entries(PERIOD_LABEL).map(([k,v])=>({value:k,label:v}))} />
          <Input label="Data *" value={editing.date} onChange={(v:string)=>setEdit((e:any)=>({...e,date:v}))} type="date" />
          <Input label="Operador *" value={editing.operator} onChange={(v:string)=>setEdit((e:any)=>({...e,operator:v}))} placeholder="Nome" />
          <Input label="Horímetro (h)" value={editing.hours_reading} onChange={(v:string)=>setEdit((e:any)=>({...e,hours_reading:parseFloat(v)||undefined}))} type="number" />
        </div>
        {checklist.length > 0 && (
          <div className="mb-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{color:'var(--t2)'}}>Checklist</label>
            {checklist.map((task,i) => (
              <div key={i} className="flex items-start gap-2 py-2" style={{borderBottom:'1px solid var(--bd)'}}>
                <button onClick={()=>setChecked(c=>({...c,[i]:!c[i]}))}
                  className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{background:checked[i]?'var(--gn)':'transparent',border:`2px solid ${checked[i]?'var(--gn)':'var(--bd2)'}`,color:'#fff',cursor:'pointer'}}>
                  {checked[i]&&'✓'}
                </button>
                <div className="text-xs">{task}</div>
              </div>
            ))}
          </div>
        )}
        {checklist.length === 0 && editing.machine_id && (
          <div className="text-xs py-2 mb-2" style={{color:'var(--t3)'}}>Nenhuma tarefa para este período. Adicione no cadastro da máquina.</div>
        )}
        <Textarea label="Observações" value={editing.notes} onChange={(v:string)=>setEdit((e:any)=>({...e,notes:v}))} rows={2} placeholder="Anomalias, recomendações..." />
        <Select label="Situação Geral" value={editing.status} onChange={(v:string)=>setEdit((e:any)=>({...e,status:v}))} options={STATUS_OPTS} />
      </Modal>
    </div>
  )
}
