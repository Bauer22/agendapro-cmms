'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, fmtDT, td } from '@/lib/utils'
import type { UserProfile } from '@/types'
import toast from 'react-hot-toast'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const CAUSES = ['Falha mecânica','Falha elétrica','Falta de peça','Falta de operador','Setup/Ajuste','Manutenção preventiva','Acidente','Falta de energia','Outro']
const TYPES = ['Corretiva não planejada','Corretiva planejada','Preventiva','Setup','Aguardando peça','Outro']

export default function DowntimePage({ profile, can }: Props) {
  const [records, setRecords]   = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [loading, setLoad]      = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEdit]      = useState<any>({})
  const [fMach, setFMach]       = useState('')
  const [indicators, setIndicators] = useState<Record<string,any>>({})
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const [r, m] = await Promise.all([
      supabase.from('downtime_records').select('*').order('start_time',{ascending:false}).order('created_at',{ascending:false}).limit(100),
      supabase.from('machines').select('id,name,icon,code'),
    ])
    setRecords(r.data||[])
    setMachines(m.data||[])
    calculateIndicators(r.data||[], m.data||[])
    setLoad(false)
  }

  function calculateIndicators(recs: any[], machs: any[]) {
    const ind: Record<string,any> = {}
    machs.forEach(m => {
      const machRecs = recs.filter(r => r.machine_id === m.id && r.duration_min)
      if (machRecs.length === 0) return
      const totalDownMin = machRecs.reduce((s:number,r:any) => s + (r.duration_min||0), 0)
      const totalPeriodDays = 30 // last 30 days reference
      const totalPeriodMin = totalPeriodDays * 24 * 60
      const totalUpMin = totalPeriodMin - totalDownMin
      const mttr = totalDownMin / machRecs.length // mean time to repair (minutes)
      const failureCount = machRecs.filter((r:any) => r.type==='Corretiva não planejada').length || machRecs.length
      const mtbf = failureCount > 0 ? totalUpMin / failureCount : totalUpMin
      const availability = (totalUpMin / totalPeriodMin) * 100
      ind[m.id] = {
        mttr: (mttr / 60).toFixed(1), // hours
        mtbf: (mtbf / 60).toFixed(1), // hours
        availability: availability.toFixed(1),
        totalDowntime: (totalDownMin / 60).toFixed(1),
        failureCount,
      }
    })
    setIndicators(ind)
  }

  function openNew() {
    const now = new Date().toISOString().slice(0,16)
    setEdit({ start_time: now, status: 'open' })
    setModal(true)
  }

  function calcDuration(start: string, end: string) {
    if (!start || !end) return undefined
    const diff = new Date(end).getTime() - new Date(start).getTime()
    return Math.round(diff / 60000) // minutes
  }

  async function save() {
    if (!editing.machine_id) { toast.error('Selecione a máquina'); return }
    if (!editing.cause)       { toast.error('Informe a causa'); return }
    const mach = machines.find(m => m.id === editing.machine_id)
    const duration_min = editing.end_time ? calcDuration(editing.start_time, editing.end_time) : undefined
    const obj = { ...editing, machine_name: mach?.name, duration_min, created_by: profile?.display_name||profile?.email }
    // remove campos que não existem na tabela / não devem ser enviados
    delete obj.id
    try {
      let error
      if (editing.id) {
        ;({ error } = await supabase.from('downtime_records').update(obj).eq('id', editing.id))
        if (error) throw error
        toast.success('Registro atualizado ✅')
      } else {
        ;({ error } = await supabase.from('downtime_records').insert({ ...obj, created_at: new Date().toISOString() }))
        if (error) throw error
        toast.success('Parada registrada ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+(e.message||JSON.stringify(e))) }
  }

  async function closeDowntime(rec: any) {
    const now = new Date().toISOString().slice(0,16)
    const duration_min = calcDuration(rec.start_time, now)
    const { error } = await supabase.from('downtime_records').update({ end_time: now, duration_min, status:'closed' }).eq('id', rec.id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success(`Parada encerrada — ${((duration_min||0)/60).toFixed(1)}h ✅`)
    load()
  }

  async function del(id: string) {
    if (!await confirm('Excluir este registro?')) return
    const { error } = await supabase.from('downtime_records').delete().eq('id', id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Excluído'); load()
  }

  const filtered = records.filter(r => !fMach || r.machine_id === fMach)
  const openDowntimes = records.filter(r => r.status === 'open')

  return (
    <div>
      {dialog}

      {/* Open downtimes alert */}
      {openDowntimes.length > 0 && (
        <div className="rounded-xl p-3 mb-3" style={{background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.3)'}}>
          <div className="text-xs font-bold mb-2" style={{color:'var(--rd)'}}>🔴 {openDowntimes.length} Parada(s) em Aberto</div>
          {openDowntimes.map(r => {
            const mach = machines.find(m=>m.id===r.machine_id)
            const elapsed = r.start_time ? Math.round((Date.now()-new Date(r.start_time).getTime())/60000) : 0
            return (
              <div key={r.id} className="flex items-center justify-between py-1.5" style={{borderBottom:'1px solid rgba(239,68,68,.2)'}}>
                <div>
                  <div className="text-xs font-bold">{mach?.icon||'⚙️'} {mach?.name}</div>
                  <div className="text-xs" style={{color:'var(--t2)'}}>{r.cause} · ⏱️ {elapsed}min</div>
                </div>
                <button onClick={()=>closeDowntime(r)} className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                  style={{background:'rgba(16,185,129,.15)',color:'var(--gn)',border:'1px solid rgba(16,185,129,.3)',fontFamily:'Sora,system-ui,sans-serif'}}>
                  ✅ Encerrar
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* MTBF/MTTR indicators */}
      {Object.keys(indicators).length > 0 && (
        <div className="mb-3">
          <SH label="Indicadores (últimos 30 dias)" />
          <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
            {machines.filter(m=>indicators[m.id]).map(m => {
              const ind = indicators[m.id]
              const avColor = parseFloat(ind.availability) > 90 ? 'var(--gn)' : parseFloat(ind.availability) > 75 ? 'var(--am)' : 'var(--rd)'
              return (
                <div key={m.id} className="flex-shrink-0 rounded-xl p-2.5" style={{background:'var(--s1)',border:'1px solid var(--bd)',minWidth:'160px'}}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-base">{m.icon||'⚙️'}</span>
                    <div className="text-xs font-bold truncate">{m.name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      {l:'MTBF',v:`${ind.mtbf}h`,c:'var(--cy)'},
                      {l:'MTTR',v:`${ind.mttr}h`,c:'var(--am)'},
                      {l:'Dispon.',v:`${ind.availability}%`,c:avColor},
                      {l:'Paradas',v:ind.failureCount,c:'var(--t2)'},
                    ].map(k=>(
                      <div key={k.l} className="text-center p-1 rounded-lg" style={{background:'var(--s2)'}}>
                        <div className="text-xs font-bold" style={{color:k.c}}>{k.v}</div>
                        <div style={{fontSize:'8px',color:'var(--t3)'}}>{k.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter + New */}
      <div className="flex gap-2 mb-2">
        <select value={fMach} onChange={e=>setFMach(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todas as máquinas</option>
          {machines.map(m=><option key={m.id} value={m.id}>{m.icon||'⚙️'} {m.name}</option>)}
        </select>
        <Btn onClick={openNew} size="sm" variant="primary">+ Registrar Parada</Btn>
      </div>

      <SH label={`Histórico de Paradas (${filtered.length})`} />
      {loading?<div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div>:
      filtered.length===0?<Empty icon="⏱️" text="Nenhuma parada registrada"/>:(
        <div className="flex flex-col gap-2">
          {filtered.map(r=>{
            const mach=machines.find(m=>m.id===r.machine_id)
            const isOpen=r.status==='open'
            return (
              <div key={r.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:`1px solid ${isOpen?'rgba(239,68,68,.4)':'var(--bd)'}`}}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base">{mach?.icon||'⚙️'}</span>
                      <div className="text-xs font-bold">{mach?.name}</div>
                      <Badge color={isOpen?'red':'green'}>{isOpen?'🔴 Em parada':'✅ Encerrada'}</Badge>
                    </div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>
                      {r.cause} · {r.type}
                    </div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>
                      ▶️ {r.start_time?.replace('T',' ').slice(0,16)}
                      {r.end_time&&` → ⏹️ ${r.end_time?.replace('T',' ').slice(0,16)}`}
                      {r.duration_min&&` · ⏱️ ${(r.duration_min/60).toFixed(1)}h`}
                    </div>
                    {r.description&&<div className="text-xs mt-1" style={{color:'var(--t3)'}}>{r.description.slice(0,60)}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {isOpen&&<button onClick={()=>closeDowntime(r)} className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(16,185,129,.15)',color:'var(--gn)',border:'1px solid rgba(16,185,129,.3)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif'}}>✅ Encerrar</button>}
                    <button onClick={()=>{setEdit({...r});setModal(true)}} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>
                    {can('admin')&&<button onClick={()=>del(r.id)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'12px'}}>🗑️</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Parada':'Registrar Parada'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Máquina *" value={editing.machine_id} onChange={(v:string)=>setEdit((e:any)=>({...e,machine_id:v}))}
          options={[{value:'',label:'Selecione...'},...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Tipo" value={editing.type} onChange={(v:string)=>setEdit((e:any)=>({...e,type:v}))} options={TYPES} />
          <Select label="Causa" value={editing.cause} onChange={(v:string)=>setEdit((e:any)=>({...e,cause:v}))} options={CAUSES} />
          <Input label="Início" value={editing.start_time} onChange={(v:string)=>setEdit((e:any)=>({...e,start_time:v}))} type="datetime-local" />
          <Input label="Fim" value={editing.end_time} onChange={(v:string)=>setEdit((e:any)=>({...e,end_time:v,status:v?'closed':'open'}))} type="datetime-local" />
        </div>
        {editing.start_time && editing.end_time && (
          <div className="rounded-xl p-2 mb-2" style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)'}}>
            <div className="text-xs font-bold" style={{color:'var(--cy)'}}>
              ⏱️ Duração: {((calcDuration(editing.start_time,editing.end_time)||0)/60).toFixed(1)}h ({calcDuration(editing.start_time,editing.end_time)} min)
            </div>
          </div>
        )}
        <Textarea label="Descrição / Observação" value={editing.description} onChange={(v:string)=>setEdit((e:any)=>({...e,description:v}))} rows={2} />
        <Input label="Responsável pelo reparo" value={editing.resp} onChange={(v:string)=>setEdit((e:any)=>({...e,resp:v}))} placeholder="Nome do técnico" />
      </Modal>
    </div>
  )
}
