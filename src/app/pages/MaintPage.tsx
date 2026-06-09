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
const RESULT_COLORS: Record<string,string> = {ok:'green',monitoring:'amber',pending:'blue',stopped:'red'}
const STATUS_OPTS = [{value:'open',label:'🔵 Em aberto'},{value:'progress',label:'🟡 Em andamento'},{value:'done',label:'✅ Finalizado'}]

export default function MaintPage({ profile, can }: Props) {
  const [recs, setRecs]     = useState<any[]>([])
  const [machines, setMach] = useState<any[]>([])
  const [loading, setLoad]  = useState(true)
  const [modal, setModal]   = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [selected, setSelected]  = useState<any>(null)
  const [editing, setEdit]  = useState<any>({})
  const [fMach, setFMach]   = useState('')
  const [fType, setFType]   = useState('')
  const [fStatus, setFStatus] = useState('')
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
    setEdit({ date: td(), result:'ok', type:'Preventiva', status:'open', machine_id: machineId, resp: profile?.display_name||'' })
    setModal(true)
  }

  function openEdit(rec: any) {
    setEdit({...rec}); setViewModal(false); setModal(true)
  }

  async function finalize(rec: any) {
    if (!await confirm(`Finalizar este registro de manutenção?`)) return
    const { error } = await supabase.from('maintenance').update({ status:'done', close_date: td() }).eq('id', rec.id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Manutenção finalizada ✅'); load()
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
        toast.success('Manutenção atualizada ✅')
      } else {
        const { error } = await supabase.from('maintenance').insert({ ...obj, status: obj.status||'open', created_at: new Date().toISOString() })
        if (error) throw error
        // Update oil if oil change
        if (editing.type === 'Troca de óleo' && mach) {
          const { data: machData } = await supabase.from('machines').select('current_hours,category').eq('id', editing.machine_id).single()
          if (machData?.category === 'transport') {
            await supabase.from('machines').update({ last_oil_hours: machData.current_hours, last_oil_date: editing.date }).eq('id', editing.machine_id)
          }
        }
        toast.success('Manutenção registrada ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir este registro?')) return
    await supabase.from('maintenance').delete().eq('id', id)
    toast.success('Excluído'); setViewModal(false); load()
  }

  const filtered = recs.filter(r =>
    (!fMach||r.machine_id===fMach) &&
    (!fType||r.type===fType) &&
    (!fStatus||r.status===fStatus)
  )

  // Stats
  const open     = recs.filter(r=>r.status==='open'||!r.status).length
  const progress = recs.filter(r=>r.status==='progress').length
  const done     = recs.filter(r=>r.status==='done').length

  return (
    <div>
      {dialog}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[
          {l:'Em Aberto',  v:open,     c:'var(--cy)'},
          {l:'Andamento',  v:progress, c:'var(--am)'},
          {l:'Finalizadas',v:done,     c:'var(--gn)'},
        ].map(k=>(
          <div key={k.l} className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div className="absolute top-0 inset-x-0 h-0.5" style={{background:k.c}}/>
            <div className="font-bebas text-2xl" style={{color:k.c}}>{k.v}</div>
            <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select value={fMach} onChange={e=>setFMach(e.target.value)} className="rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todas as máquinas</option>
          {machines.map(m=><option key={m.id} value={m.id}>{m.icon||'⚙️'} {m.name}</option>)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} className="rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todos os status</option>
          {STATUS_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <SH label={`Registros (${filtered.length})`} action={can('maint')&&<Btn onClick={()=>openNew()} size="sm" variant="primary">+ Registrar</Btn>} />

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : filtered.length===0 ? <Empty icon="🔧" text="Nenhum registro" /> : (
        <div className="flex flex-col gap-2">
          {filtered.map(r => {
            const mach = machines.find(m=>m.id===r.machine_id)
            const isDone = r.status==='done'
            const isProgress = r.status==='progress'
            const borderColor = isDone ? 'rgba(16,185,129,.3)' : isProgress ? 'rgba(245,158,11,.35)' : 'var(--bd)'
            return (
              <div key={r.id} onClick={()=>{setSelected(r);setViewModal(true)}} className="p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:`1px solid ${borderColor}`}}>
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 pt-0.5">{mach?.icon||'🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="text-xs font-semibold">{mach?.name||'Máquina'} — {r.type}</div>
                      <Badge color={isDone?'green':isProgress?'amber':'blue'}>{isDone?'Finalizado':isProgress?'Andamento':'Em aberto'}</Badge>
                    </div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>👤 {r.resp} · 📅 {fmtD(r.date)}{r.duration&&` · ⏱️ ${r.duration}h`}</div>
                    {r.description&&<div className="text-xs mt-1" style={{color:'var(--t3)'}}>{r.description.slice(0,70)}</div>}
                    <div className="text-xs mt-0.5">
                      <Badge color={RESULT_COLORS[r.result] as any}>{RESULT_LABELS[r.result]||r.result}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View Modal */}
      {selected && (
        <Modal open={viewModal} onClose={()=>setViewModal(false)} title={`${selected.machine_name||'Manutenção'} — ${selected.type}`}
          footer={
            <div className="flex gap-2 w-full flex-wrap">
              <Btn onClick={()=>setViewModal(false)} variant="secondary" size="md">Fechar</Btn>
              {can('maint')&&<Btn onClick={()=>openEdit(selected)} variant="primary" size="md">✏️ Editar</Btn>}
              {can('maint')&&selected.status!=='done'&&<Btn onClick={()=>finalize(selected)} variant="secondary" size="md">✅ Finalizar</Btn>}
              {can('admin')&&<Btn onClick={()=>del(selected.id)} variant="danger" size="md">🗑️</Btn>}
            </div>
          }>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge color={selected.status==='done'?'green':selected.status==='progress'?'amber':'blue'}>
              {selected.status==='done'?'Finalizado':selected.status==='progress'?'Em andamento':'Em aberto'}
            </Badge>
            <Badge color={RESULT_COLORS[selected.result] as any}>{RESULT_LABELS[selected.result]}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            {[
              ['Responsável', selected.resp],
              ['Data', fmtD(selected.date)],
              ['Duração', selected.duration?`${selected.duration}h`:null],
              ['Tipo', selected.type],
              ['Abertura', fmtD(selected.date)],
              ['Fechamento', fmtD(selected.close_date)],
            ].filter(([,v])=>v).map(([k,v])=>(
              <div key={String(k)}>
                <div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',letterSpacing:'.4px'}}>{k}</div>
                <div className="font-semibold text-xs mt-0.5">{String(v)}</div>
              </div>
            ))}
          </div>
          {selected.description&&<div className="mb-2"><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',marginBottom:4}}>Descrição</div><div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>{selected.description}</div></div>}
          {selected.parts&&<div className="mb-2"><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',marginBottom:4}}>Peças</div><div className="text-xs" style={{color:'var(--t2)'}}>{selected.parts}</div></div>}
        </Modal>
      )}

      {/* Edit/Create Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Manutenção':'Registrar Manutenção'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Máquina *" value={editing.machine_id} onChange={(v:string)=>setEdit((e:any)=>({...e,machine_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Tipo *" value={editing.type} onChange={(v:string)=>setEdit((e:any)=>({...e,type:v}))} options={TYPES} />
          <Input label="Data *" value={editing.date} onChange={(v:string)=>setEdit((e:any)=>({...e,date:v}))} type="date" />
          <Input label="Responsável *" value={editing.resp} onChange={(v:string)=>setEdit((e:any)=>({...e,resp:v}))} placeholder="Nome do técnico" />
          <Input label="Duração (h)" value={editing.duration} onChange={(v:string)=>setEdit((e:any)=>({...e,duration:parseFloat(v)||undefined}))} type="number" placeholder="0.5" />
        </div>
        <Select label="Status" value={editing.status||'open'} onChange={(v:string)=>setEdit((e:any)=>({...e,status:v}))} options={STATUS_OPTS} />
        <Input label="Peças Utilizadas" value={editing.parts} onChange={(v:string)=>setEdit((e:any)=>({...e,parts:v}))} placeholder="Ex: Filtro AR-001..." />
        <Textarea label="Descrição do serviço" value={editing.description} onChange={(v:string)=>setEdit((e:any)=>({...e,description:v}))} rows={3} placeholder="Descreva o serviço..." />
        <Select label="Situação após" value={editing.result} onChange={(v:string)=>setEdit((e:any)=>({...e,result:v}))} options={RESULTS} />
        {editing.status==='done'&&<Input label="Data Fechamento" value={editing.close_date} onChange={(v:string)=>setEdit((e:any)=>({...e,close_date:v}))} type="date" />}
      </Modal>
    </div>
  )
}
