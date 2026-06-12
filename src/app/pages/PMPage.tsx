'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, td, PERIOD_LABEL } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const STATUS_OPTS = [{value:'ok',label:'✅ Conforme'},{value:'partial',label:'⚠️ Parcialmente'},{value:'nok',label:'❌ Não conforme'}]
const STATUS_COLORS: Record<string,string> = {ok:'var(--gn)',partial:'var(--am)',nok:'var(--rd)'}
const STATUS_LABELS: Record<string,string> = {ok:'✅ Conforme',partial:'⚠️ Parcialmente',nok:'❌ Não conforme'}
const PM_STATUS_OPTS = [{value:'open',label:'🔵 Em aberto'},{value:'progress',label:'🟡 Em andamento'},{value:'done',label:'✅ Finalizado'}]
const PM_STATUS_COLOR: Record<string,string> = {open:'blue',progress:'amber',done:'green'}
const PM_STATUS_LABEL: Record<string,string> = {open:'Em aberto',progress:'Em andamento',done:'Finalizado'}

// Repair order status
const REP_STATUS_OPTS = [{value:'open',label:'🔵 Aguardando envio'},{value:'sent',label:'📦 Enviado para conserto'},{value:'returned',label:'🔄 Retornou'},{value:'done',label:'✅ Finalizado'}]
const REP_STATUS_COLOR: Record<string,string> = {open:'blue',sent:'amber',returned:'purple',done:'green'}
const REP_STATUS_LABEL: Record<string,string> = {open:'Aguardando envio',sent:'Enviado',returned:'Retornou',done:'Finalizado'}

export default function PMPage({ profile, can }: Props) {
  const [recs, setRecs]         = useState<any[]>([])
  const [repairs, setRepairs]   = useState<any[]>([])
  const [machines, setMach]     = useState<any[]>([])
  const [parts, setParts]       = useState<any[]>([])
  const [users, setUsers]       = useState<any[]>([])
  const [loading, setLoad]      = useState(true)
  const [tab, setTab]           = useState('pm')
  const [modal, setModal]       = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [repairModal, setRepairModal] = useState(false)
  const [repairViewModal, setRepairViewModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [selectedRepair, setSelectedRepair] = useState<any>(null)
  const [editing, setEdit]      = useState<any>({})
  const [editRepair, setEditRepair] = useState<any>({})
  const [checklist, setChecklist] = useState<string[]>([])
  const [checked, setChecked]   = useState<Record<number,boolean>>({})
  const [fMach, setFMach]       = useState('')
  const [fPeriod, setFPeriod]   = useState('')
  const [fStatus, setFStatus]   = useState('')
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load() }, [tab])

  async function load() {
    const [m, p, u] = await Promise.all([
      supabase.from('machines').select('id,name,icon,pm_plan,current_hours'),
      supabase.from('parts').select('id,name,code,unit,stock'),
      supabase.from('profiles').select('id,display_name,email,role,shift'),
    ])
    setMach(m.data||[]); setParts(p.data||[])
    const userList = (u.data||[]).map((x:any) => {
      let name = x.display_name || ''
      if (!name || (name.includes('-') && name.length > 30)) name = x.email?.split('@')[0] || 'Usuário'
      return { ...x, display_name: name }
    }).sort((a:any,b:any) => a.display_name.localeCompare(b.display_name))
    setUsers(userList)

    if (tab==='pm') {
      const { data } = await supabase.from('pm_reports').select('*').order('date',{ascending:false}).limit(100)
      setRecs(data||[])
    } else {
      const { data } = await supabase.from('repair_orders').select('*').order('created_at',{ascending:false}).limit(100)
      setRepairs(data||[])
    }
    setLoad(false)
  }

  function openNew() {
    const defaultOperator = profile?.display_name && !profile.display_name.includes('-') 
      ? profile.display_name 
      : profile?.email?.split('@')[0] || ''
    setEdit({ date: td(), status:'ok', pm_status:'open', operator: defaultOperator, operator_id: profile?.id, period:'monthly' })
    setChecklist([]); setChecked({})
    setModal(true)
  }

  function openEdit(rec: any) {
    setEdit({...rec})
    const mach = machines.find(m=>m.id===rec.machine_id)
    const tasks = (mach?.pm_plan||[]).filter((p:any)=>p.period===rec.period).map((p:any)=>p.task)
    setChecklist(tasks)
    const ckObj = rec.checklist||{}
    const ckBool: Record<number,boolean> = {}
    tasks.forEach((_:string,i:number) => { ckBool[i] = !!ckObj[i] })
    setChecked(ckBool)
    setViewModal(false); setModal(true)
  }

  async function finalize(rec: any) {
    if (!await confirm('Finalizar este relatório de MP?')) return
    const { error: ePm } = await supabase.from('pm_reports').update({ pm_status:'done', close_date: td() }).eq('id', rec.id)
    if (ePm) { toast.error('Erro: '+ePm.message); return }
    toast.success('MP finalizado ✅'); setViewModal(false); load()
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
      pm_status: editing.pm_status||'open',
      checklist: checklist.reduce((acc:any,_t:string,i:number)=>({...acc,[i]:!!checked[i]}),{}),
      created_by: profile?.display_name||profile?.email,
    }
    try {
      if (editing.id) {
        const { error } = await supabase.from('pm_reports').update(obj).eq('id', editing.id)
        if (error) throw error
        toast.success('MP atualizado ✅')
      } else {
        const { error } = await supabase.from('pm_reports').insert({ ...obj, created_at: new Date().toISOString() })
        if (error) throw error
        toast.success('MP registrado ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir este registro?')) return
    const { error: eDel } = await supabase.from('pm_reports').delete().eq('id', id)
    if (eDel) { toast.error('Erro: '+eDel.message); return }
    toast.success('Excluído'); setViewModal(false); load()
  }

  // ── REPAIR ORDERS ──────────────────────────────────────────────
  function openNewRepair() {
    setEditRepair({ created_date: td(), status:'open', parts_list: [] })
    setRepairModal(true)
  }

  function openEditRepair(rep: any) {
    setEditRepair({ ...rep, parts_list: rep.parts_list||[] })
    setRepairViewModal(false); setRepairModal(true)
  }

  function addRepairPart() {
    const pid = editRepair._part_select
    const qty = editRepair._part_qty||1
    if (!pid) { toast.error('Selecione a peça'); return }
    const part = parts.find(p=>p.id===pid)
    if (!part) return
    const existing = editRepair.parts_list||[]
    const already = existing.find((x:any)=>x.part_id===pid)
    if (already) {
      setEditRepair((e:any)=>({...e, parts_list: existing.map((x:any)=>x.part_id===pid?{...x,qty:x.qty+(qty||1)}:x)}))
    } else {
      setEditRepair((e:any)=>({...e, parts_list: [...existing, {part_id:pid,part_name:part.name,part_code:part.code,unit:part.unit,qty}]}))
    }
    setEditRepair((e:any)=>({...e,_part_select:'',_part_qty:1}))
  }

  function removeRepairPart(idx: number) {
    setEditRepair((e:any)=>({...e,parts_list:(e.parts_list||[]).filter((_:any,i:number)=>i!==idx)}))
  }

  async function saveRepair() {
    if (!editRepair.machine_id) { toast.error('Selecione a máquina'); return }
    if (!editRepair.description) { toast.error('Descreva o problema'); return }
    const mach = machines.find(m=>m.id===editRepair.machine_id)
    const obj = {
      ...editRepair,
      machine_name: mach?.name,
      created_by: profile?.display_name||profile?.email,
    }
    // Remove UI-only fields
    delete obj._part_select; delete obj._part_qty; delete obj._was_status
    try {
      if (editRepair.id) {
        delete obj._was_status
        const { error } = await supabase.from('repair_orders').update(obj).eq('id', editRepair.id)
        if (error) throw error

        // If finalizing (returned → done), deduct parts from stock
        if (editRepair.status==='done' && editRepair._was_status!=='done') {
          for (const p of (editRepair.parts_list||[])) {
            const partData = parts.find((x:any)=>x.id===p.part_id)
            if (partData) {
              const newStock = Math.max(0, (partData.stock||0) - (p.qty||0))
              const { error: ePs } = await supabase.from('parts').update({ stock: newStock }).eq('id', p.part_id)
              if (ePs) toast.error('Erro estoque: '+ePs.message)
              const { error: eSm } = await supabase.from('stock_movements').insert({ part_id: p.part_id, part_name: p.part_name, type:'out', quantity: p.qty, reason: `Conserto: ${mach?.name}`, stock_after: newStock, created_by: profile?.display_name, created_at: new Date().toISOString() })
              if (eSm) toast.error('Erro movimento: '+eSm.message)
            }
          }
          toast.success('Peças baixadas do estoque ✅')
        }
        toast.success('Conserto atualizado ✅')
      } else {
        const { error } = await supabase.from('repair_orders').insert({ ...obj, created_at: new Date().toISOString() })
        if (error) throw error
        toast.success('Envio para conserto registrado ✅')
      }
      setRepairModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function delRepair(id: string) {
    if (!await confirm('Excluir este registro de conserto?')) return
    const { error: eDelR } = await supabase.from('repair_orders').delete().eq('id', id)
    if (eDelR) { toast.error('Erro: '+eDelR.message); return }
    toast.success('Excluído'); setRepairViewModal(false); load()
  }

  const filteredPM = recs.filter(r =>
    (!fMach||r.machine_id===fMach) &&
    (!fPeriod||r.period===fPeriod) &&
    (!fStatus||r.pm_status===fStatus)
  )

  // Stats
  const pmOpen  = recs.filter(r=>r.pm_status==='open'||!r.pm_status).length
  const pmDone  = recs.filter(r=>r.pm_status==='done').length
  const repOpen = repairs.filter(r=>r.status==='open'||r.status==='sent').length

  return (
    <div>
      {dialog}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3">
        {[
          {k:'pm',     l:`📝 Preventivas`},
          {k:'repair', l:`🔩 Consertos${repOpen>0?` (${repOpen})`:''}` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── PM TAB ── */}
      {tab==='pm' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[{l:'Em Aberto',v:pmOpen,c:'var(--cy)'},{l:'Andamento',v:recs.filter(r=>r.pm_status==='progress').length,c:'var(--am)'},{l:'Finalizados',v:pmDone,c:'var(--gn)'}].map(k=>(
              <div key={k.l} className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="absolute top-0 inset-x-0 h-0.5" style={{background:k.c}}/>
                <div className="font-bebas text-2xl" style={{color:k.c}}>{k.v}</div>
                <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>{k.l}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <select value={fMach} onChange={e=>setFMach(e.target.value)} className="rounded-xl px-2 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
              <option value="">Todas</option>
              {machines.map(m=><option key={m.id} value={m.id}>{m.icon||'⚙️'} {m.name}</option>)}
            </select>
            <select value={fPeriod} onChange={e=>setFPeriod(e.target.value)} className="rounded-xl px-2 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
              <option value="">Período</option>
              {Object.entries(PERIOD_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} className="rounded-xl px-2 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
              <option value="">Status</option>
              {PM_STATUS_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <SH label={`Relatórios MP (${filteredPM.length})`} action={can('pm')&&<Btn onClick={openNew} size="sm" variant="primary">+ Preencher</Btn>} />

          {loading?<div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div>:filteredPM.length===0?<Empty icon="📝" text="Nenhum relatório"/>:(
            <div className="flex flex-col gap-2">
              {filteredPM.map(r=>{
                const mach=machines.find(m=>m.id===r.machine_id)
                const ck=r.checklist||{}; const ok=Object.values(ck).filter(Boolean).length; const tt=Object.keys(ck).length
                const pms = r.pm_status||'open'
                return (
                  <div key={r.id} onClick={()=>{setSelected(r);setViewModal(true)}} className="p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0">{mach?.icon||'📝'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="text-xs font-semibold">{mach?.name||'Máquina'} — {PERIOD_LABEL[r.period]||r.period}</div>
                          <Badge color={PM_STATUS_COLOR[pms] as any}>{PM_STATUS_LABEL[pms]}</Badge>
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>👤 {r.operator} · 📅 {fmtD(r.date)}{tt?` · ✅ ${ok}/${tt}`:''}{r.hours_reading?` · ⏱️ ${r.hours_reading}h`:''}</div>
                        <div className="text-xs mt-0.5" style={{color:STATUS_COLORS[r.status]||'var(--t3)'}}>{STATUS_LABELS[r.status]||r.status}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* View Modal */}
          {selected&&(
            <Modal open={viewModal} onClose={()=>setViewModal(false)} title={`${selected.machine_name||'MP'} — ${PERIOD_LABEL[selected.period]||selected.period}`}
              footer={
                <div className="flex gap-2 w-full flex-wrap">
                  <Btn onClick={()=>setViewModal(false)} variant="secondary" size="md">Fechar</Btn>
                  {can('pm')&&<Btn onClick={()=>openEdit(selected)} variant="primary" size="md">✏️ Editar</Btn>}
                  {can('pm')&&selected.pm_status!=='done'&&<Btn onClick={()=>finalize(selected)} variant="secondary" size="md">✅ Finalizar</Btn>}
                  {can('admin')&&<Btn onClick={()=>del(selected.id)} variant="danger" size="md">🗑️</Btn>}
                </div>
              }>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge color={PM_STATUS_COLOR[selected.pm_status||'open'] as any}>{PM_STATUS_LABEL[selected.pm_status||'open']}</Badge>
                <Badge color={selected.status==='ok'?'green':selected.status==='partial'?'amber':'red'}>{STATUS_LABELS[selected.status]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                {[['Operador',selected.operator],['Data',fmtD(selected.date)],['Horímetro',selected.hours_reading?`${selected.hours_reading}h`:null],['Fechamento',fmtD(selected.close_date)]].filter(([,v])=>v).map(([k,v])=>(
                  <div key={String(k)}><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase'}}>{k}</div><div className="font-semibold text-xs mt-0.5">{String(v)}</div></div>
                ))}
              </div>
              {selected.checklist&&Object.keys(selected.checklist).length>0&&(
                <div className="mb-3">
                  <div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',marginBottom:6}}>Checklist</div>
                  {Object.entries(selected.checklist).map(([i,v]:any)=>(
                    <div key={i} className="flex items-center gap-2 py-1.5" style={{borderBottom:'1px solid var(--bd)'}}>
                      <div className="w-4 h-4 rounded flex items-center justify-center text-xs" style={{background:v?'var(--gn)':'transparent',border:`1.5px solid ${v?'var(--gn)':'var(--bd2)'}`,color:'#fff',flexShrink:0}}>{v&&'✓'}</div>
                      <div className="text-xs">{checklist[parseInt(i)]||`Item ${parseInt(i)+1}`}</div>
                    </div>
                  ))}
                </div>
              )}
              {selected.notes&&<div><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',marginBottom:4}}>Observações</div><div className="text-xs" style={{color:'var(--t2)'}}>{selected.notes}</div></div>}
            </Modal>
          )}
        </>
      )}

      {/* ── REPAIR TAB ── */}
      {tab==='repair' && (
        <>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              {l:'Em Aberto/Enviado',v:repOpen,c:'var(--am)'},
              {l:'Finalizados',v:repairs.filter(r=>r.status==='done').length,c:'var(--gn)'},
            ].map(k=>(
              <div key={k.l} className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="absolute top-0 inset-x-0 h-0.5" style={{background:k.c}}/>
                <div className="font-bebas text-2xl" style={{color:k.c}}>{k.v}</div>
                <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>{k.l}</div>
              </div>
            ))}
          </div>

          <SH label={`Envios para Conserto (${repairs.length})`} action={can('pm')&&<Btn onClick={openNewRepair} size="sm" variant="primary">+ Enviar Peça</Btn>} />

          {loading?<div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div>:repairs.length===0?<Empty icon="🔩" text="Nenhum envio para conserto"/>:(
            <div className="flex flex-col gap-2">
              {repairs.map(r=>{
                const mach=machines.find(m=>m.id===r.machine_id)
                return (
                  <div key={r.id} onClick={()=>{setSelectedRepair(r);setRepairViewModal(true)}} className="p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:`1px solid ${r.status==='sent'?'rgba(245,158,11,.4)':r.status==='done'?'rgba(16,185,129,.3)':'var(--bd)'}`}}>
                    <div className="flex items-start gap-2">
                      <span className="text-base">🔩</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="text-xs font-semibold truncate">{r.item_name||'Peça/Componente'}</div>
                          <Badge color={REP_STATUS_COLOR[r.status] as any}>{REP_STATUS_LABEL[r.status]}</Badge>
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>⚙️ {mach?.name||'—'} · 📅 {fmtD(r.created_date)}</div>
                        {r.supplier_name&&<div className="text-xs" style={{color:'var(--t3)'}}>🏭 {r.supplier_name}</div>}
                        {(r.parts_list||[]).length>0&&<div className="text-xs mt-0.5" style={{color:'var(--cy)'}}>📦 {r.parts_list.length} peça(s) vinculada(s)</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Repair View Modal */}
          {selectedRepair&&(
            <Modal open={repairViewModal} onClose={()=>setRepairViewModal(false)} title={`Conserto: ${selectedRepair.item_name}`}
              footer={
                <div className="flex gap-2 w-full flex-wrap">
                  <Btn onClick={()=>setRepairViewModal(false)} variant="secondary" size="md">Fechar</Btn>
                  {can('pm')&&<Btn onClick={()=>openEditRepair(selectedRepair)} variant="primary" size="md">✏️ Editar</Btn>}
                  {can('admin')&&<Btn onClick={()=>delRepair(selectedRepair.id)} variant="danger" size="md">🗑️</Btn>}
                </div>
              }>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge color={REP_STATUS_COLOR[selectedRepair.status] as any}>{REP_STATUS_LABEL[selectedRepair.status]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                {[
                  ['Máquina', selectedRepair.machine_name],
                  ['Enviado em', fmtD(selectedRepair.sent_date)],
                  ['Retornou em', fmtD(selectedRepair.return_date)],
                  ['Fornecedor', selectedRepair.supplier_name],
                  ['Custo', selectedRepair.cost?`R$ ${selectedRepair.cost}`:null],
                ].filter(([,v])=>v).map(([k,v])=>(
                  <div key={String(k)}><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase'}}>{k}</div><div className="font-semibold text-xs mt-0.5">{String(v)}</div></div>
                ))}
              </div>
              {selectedRepair.description&&<div className="mb-3"><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',marginBottom:4}}>Problema</div><div className="text-xs" style={{color:'var(--t2)'}}>{selectedRepair.description}</div></div>}
              {selectedRepair.solution&&<div className="mb-3 rounded-xl p-2.5" style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.25)'}}><div className="text-xs font-bold mb-1" style={{color:'var(--gn)'}}>✅ SOLUÇÃO</div><div className="text-xs" style={{color:'var(--t2)'}}>{selectedRepair.solution}</div></div>}
              {(selectedRepair.parts_list||[]).length>0&&(
                <div><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',marginBottom:6}}>Peças Utilizadas</div>
                {selectedRepair.parts_list.map((p:any,i:number)=>(
                  <div key={i} className="flex items-center justify-between py-1.5" style={{borderBottom:'1px solid var(--bd)'}}>
                    <div className="text-xs">{p.part_name} <span style={{color:'var(--t3)'}}>({p.part_code})</span></div>
                    <div className="text-xs font-bold" style={{color:'var(--cy)'}}>{p.qty} {p.unit}</div>
                  </div>
                ))}</div>
              )}
            </Modal>
          )}
        </>
      )}

      {/* PM Edit/Create Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Relatório MP':'Novo Relatório MP'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Máquina *" value={editing.machine_id} onChange={(v:string)=>{setEdit((e:any)=>({...e,machine_id:v}));loadChecklist(v,editing.period||'monthly')}} options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} className="col-span-2" />
          <Select label="Período *" value={editing.period} onChange={(v:string)=>{setEdit((e:any)=>({...e,period:v}));loadChecklist(editing.machine_id||'',v)}}
            options={Object.entries(PERIOD_LABEL).map(([k,v])=>({value:k,label:v}))} />
          <Input label="Data *" value={editing.date} onChange={(v:string)=>setEdit((e:any)=>({...e,date:v}))} type="date" />
          <Select label="Responsável *" value={editing.operator_id||''} onChange={(v:string)=>{
              const u=users.find((x:any)=>x.id===v)
              const name = u ? (u.display_name||u.email?.split('@')[0]||'') : ''
              setEdit((e:any)=>({...e,operator_id:v,operator:name}))
            }} options={[{value:'',label:'Selecione o responsável...'}, ...users.map((u:any)=>({value:u.id,label:`${u.display_name}${u.shift?' (Turno '+u.shift+')':''}`}))]} />
          <Input label="Horímetro (h)" value={editing.hours_reading} onChange={(v:string)=>setEdit((e:any)=>({...e,hours_reading:parseFloat(v)||undefined}))} type="number" />
        </div>
        <Select label="Status da Execução" value={editing.pm_status||'open'} onChange={(v:string)=>setEdit((e:any)=>({...e,pm_status:v}))} options={PM_STATUS_OPTS} />
        {editing.pm_status==='done'&&<Input label="Data Fechamento" value={editing.close_date} onChange={(v:string)=>setEdit((e:any)=>({...e,close_date:v}))} type="date" />}
        {checklist.length>0&&(
          <div className="mb-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{color:'var(--t2)'}}>Checklist</label>
            {checklist.map((task,i)=>(
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
        <Textarea label="Observações" value={editing.notes} onChange={(v:string)=>setEdit((e:any)=>({...e,notes:v}))} rows={2} />
        <Select label="Situação Geral" value={editing.status} onChange={(v:string)=>setEdit((e:any)=>({...e,status:v}))} options={STATUS_OPTS} />
      </Modal>

      {/* Repair Modal */}
      <Modal open={repairModal} onClose={()=>setRepairModal(false)} title={editRepair.id?'Editar Conserto':'Enviar Peça para Conserto'}
        footer={<><Btn onClick={()=>setRepairModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveRepair} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Máquina *" value={editRepair.machine_id} onChange={(v:string)=>setEditRepair((e:any)=>({...e,machine_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <Select label="Responsável" value={editRepair.operator_id||''} onChange={(v:string)=>{
            const u=users.find((x:any)=>x.id===v)
            const name = u ? (u.display_name||u.email?.split('@')[0]||'') : ''
            setEditRepair((e:any)=>({...e,operator_id:v,operator:name}))
          }} options={[{value:'',label:'Selecione o responsável...'}, ...users.map((u:any)=>({value:u.id,label:u.display_name}))]} />
        <Input label="Item / Peça enviada *" value={editRepair.item_name} onChange={(v:string)=>setEditRepair((e:any)=>({...e,item_name:v}))} placeholder="Ex: Motor bomba hidráulica" />
        <Textarea label="Problema / Descrição *" value={editRepair.description} onChange={(v:string)=>setEditRepair((e:any)=>({...e,description:v}))} rows={2} placeholder="Descreva o problema..." />
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Data Envio" value={editRepair.created_date} onChange={(v:string)=>setEditRepair((e:any)=>({...e,created_date:v}))} type="date" />
          <Input label="Data Retorno" value={editRepair.return_date} onChange={(v:string)=>setEditRepair((e:any)=>({...e,return_date:v,_was_status:editRepair.status}))} type="date" />
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Fornecedor/Oficina" value={editRepair.supplier_name} onChange={(v:string)=>setEditRepair((e:any)=>({...e,supplier_name:v}))} placeholder="Nome da oficina" />
          <Input label="Custo R$" value={editRepair.cost} onChange={(v:string)=>setEditRepair((e:any)=>({...e,cost:parseFloat(v)||undefined}))} type="number" placeholder="0.00" />
        </div>
        <Select label="Status" value={editRepair.status||'open'} onChange={(v:string)=>setEditRepair((e:any)=>({...e,status:v,_was_status:editRepair.status}))} options={REP_STATUS_OPTS} />
        {(editRepair.status==='returned'||editRepair.status==='done')&&(
          <Textarea label="Solução / O que foi feito" value={editRepair.solution} onChange={(v:string)=>setEditRepair((e:any)=>({...e,solution:v}))} rows={2} placeholder="Descreva a solução..." />
        )}

        {/* Parts list */}
        <div className="rounded-xl p-2.5 mt-1" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>
          <div className="text-xs font-bold mb-2" style={{color:'var(--cy)'}}>📦 Peças Utilizadas no Conserto</div>
          {(editRepair.parts_list||[]).map((p:any,i:number)=>(
            <div key={i} className="flex items-center justify-between py-1.5" style={{borderBottom:'1px solid var(--bd)'}}>
              <div className="text-xs">{p.part_name} <span style={{color:'var(--t3)'}}>({p.part_code})</span></div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{color:'var(--cy)'}}>{p.qty} {p.unit}</span>
                <button onClick={()=>removeRepairPart(i)} style={{background:'none',border:'none',color:'var(--rd)',cursor:'pointer',fontSize:'12px'}}>×</button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <select value={editRepair._part_select||''} onChange={e=>setEditRepair((x:any)=>({...x,_part_select:e.target.value}))}
              className="flex-1 rounded-xl px-2 py-1.5 text-xs outline-none"
              style={{background:'var(--s3)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
              <option value="">Selecionar peça...</option>
              {parts.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit})</option>)}
            </select>
            <input type="number" min="1" value={editRepair._part_qty||1}
              onChange={e=>setEditRepair((x:any)=>({...x,_part_qty:parseFloat(e.target.value)||1}))}
              className="w-14 rounded-xl px-2 py-1.5 text-xs outline-none text-center"
              style={{background:'var(--s3)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}} />
            <Btn onClick={addRepairPart} size="sm" variant="primary">+ Add</Btn>
          </div>
          {editRepair.status==='done'&&(editRepair.parts_list||[]).length>0&&(
            <div className="text-xs mt-2 p-2 rounded-lg" style={{background:'rgba(245,158,11,.1)',color:'var(--am)'}}>
              ⚠️ Ao finalizar, as peças serão baixadas automaticamente do estoque.
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
