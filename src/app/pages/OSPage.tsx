'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, SearchBar, Chips, useConfirm } from '@/components/ui'
import { fmtD, td, STATUS_INFO, PRIO_LABEL, PRIO_COLOR } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { WorkOrder, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const STATUSES = [
  {value:'open',     label:'🔵 Aberta'},
  {value:'progress', label:'🟡 Em andamento'},
  {value:'done',     label:'🟢 Concluída'},
  {value:'cancelled',label:'⚫ Cancelada'},
]
const TYPES = ['Preventiva','Corretiva','Preditiva','Inspeção','Lubrificação','Instalação','Outro']
const PRIORITIES = [
  {value:'low',label:'🟢 Baixa'},{value:'medium',label:'🟡 Média'},
  {value:'high',label:'🔴 Alta'},{value:'critical',label:'🟣 Crítica'},
]

const COLS = [
  {key:'open',     label:'Abertas',      dot:'#3b82f6'},
  {key:'progress', label:'Em Andamento', dot:'#f59e0b'},
  {key:'done',     label:'Concluídas',   dot:'#10b981'},
  {key:'cancelled',label:'Canceladas',   dot:'#6b7280'},
]

export default function OSPage({ profile, can }: Props) {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [view, setView] = useState<WorkOrder|null>(null)
  const [editing, setEditing] = useState<Partial<WorkOrder>>({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [counter, setCounter] = useState(1)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); loadMeta() }, [])

  async function load() {
    const { data } = await supabase.from('work_orders').select('*').order('created_at',{ascending:false})
    setOrders(data || [])
    setLoading(false)
  }
  async function loadMeta() {
    const [m, u, c] = await Promise.all([
      supabase.from('machines').select('id,name,code,icon'),
      supabase.from('profiles').select('id,display_name,email'),
      supabase.from('os_counter').select('val').single(),
    ])
    setMachines(m.data||[])
    setUsers(u.data||[])
    if (c.data?.val) setCounter(c.data.val + 1)
  }

  function openNew(status='open') {
    setEditing({ status: status as any, priority:'medium', open_date: td(), type:'Corretiva', number: `OS-${String(counter).padStart(4,'0')}` })
    setView(null); setModal(true)
  }
  function openEdit(o: WorkOrder) { setEditing({...o}); setView(null); setModal(true) }

  async function save() {
    if (!editing.title) { toast.error('Informe o título'); return }
    const mach = machines.find(m => m.id === editing.machine_id)
    const usr  = users.find(u => u.id === editing.resp_id)
    const obj = { ...editing, machine_name: mach?.name, machine_code: mach?.code, resp_name: usr?.display_name||usr?.email }
    try {
      if (editing.id) {
        const { error } = await supabase.from('work_orders').update(obj).eq('id', editing.id)
        if (error) throw error
        toast.success('OS atualizada ✅')
      } else {
        const { error } = await supabase.from('work_orders').insert({ ...obj, created_by: profile?.display_name||profile?.email })
        if (error) throw error
        await supabase.from('os_counter').upsert({ id:1, val: counter })
        setCounter(c => c+1)
        toast.success(`OS ${obj.number} criada ✅`)
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: ' + e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta OS permanentemente?')) return
    await supabase.from('work_orders').delete().eq('id', id)
    toast.success('OS excluída'); setView(null); load()
  }

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchQ = !q || o.title?.toLowerCase().includes(q) || o.number?.toLowerCase().includes(q) || o.machine_name?.toLowerCase().includes(q)
    const matchF = !filter || o.machine_id === filter
    return matchQ && matchF
  })

  const today = td()
  const byStatus: Record<string,WorkOrder[]> = { open:[], progress:[], done:[], cancelled:[] }
  filtered.forEach(o => { const k = o.status||'open'; if(byStatus[k]) byStatus[k].push(o) })

  return (
    <div>
      {dialog}
      <div className="flex gap-2 mb-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar OS..."
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
          onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
        <Btn onClick={()=>openNew()} size="sm" variant="primary">+ Nova OS</Btn>
      </div>

      {/* Machine filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
        <button onClick={()=>setFilter('')} className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer"
          style={{background:!filter?'var(--cy)':'transparent',color:!filter?'#000':'var(--t2)',borderColor:!filter?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>Todas</button>
        {machines.map(m => (
          <button key={m.id} onClick={()=>setFilter(m.id)} className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer"
            style={{background:filter===m.id?'var(--cy)':'transparent',color:filter===m.id?'#000':'var(--t2)',borderColor:filter===m.id?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {m.icon||'⚙️'} {m.name}
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : (
        <div className="flex gap-2 overflow-x-auto pb-2" style={{scrollbarWidth:'thin'}}>
          {COLS.map(col => (
            <div key={col.key} className="flex-shrink-0 w-56 rounded-xl p-2.5" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <div className="w-2 h-2 rounded-full" style={{background:col.dot}}/>
                  {col.label}
                </div>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{background:'var(--s2)',color:'var(--t2)'}}>{byStatus[col.key].length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {byStatus[col.key].map(o => {
                  const late = o.due_date && o.due_date < today && o.status !== 'done' && o.status !== 'cancelled'
                  return (
                    <div key={o.id} onClick={()=>setView(o)} className="rounded-xl p-2 cursor-pointer transition-all"
                      style={{background:'var(--bg2)',border:`1px solid ${late?'rgba(239,68,68,.4)':'var(--bd)'}`,boxShadow:late?'0 0 8px rgba(239,68,68,.1)':'none'}}>
                      <div className="text-xs" style={{color:'var(--t3)',fontFamily:'monospace'}}>{o.number}</div>
                      <div className="text-xs font-semibold mt-0.5 leading-tight">{o.title}</div>
                      <div className="text-xs mt-1" style={{color:'var(--t2)'}}>⚙️ {o.machine_name||'—'}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-lg" style={{background:PRIO_COLOR[o.priority]+'22',color:PRIO_COLOR[o.priority],fontSize:'9px'}}>
                          {PRIO_LABEL[o.priority]||'—'}
                        </span>
                        {late ? <span className="text-xs font-bold" style={{color:'var(--rd)',fontSize:'9px'}}>⚠️ Atrasada</span>
                               : o.due_date ? <span className="text-xs" style={{color:'var(--t3)',fontSize:'9px'}}>📅 {fmtD(o.due_date)}</span> : null}
                      </div>
                      <div className="text-xs mt-1" style={{color:'var(--t3)',fontSize:'9px'}}>👤 {o.resp_name||'—'}</div>
                    </div>
                  )
                })}
                {(col.key==='open'||col.key==='progress') && (
                  <button onClick={()=>openNew(col.key)} className="w-full py-1.5 rounded-xl text-xs cursor-pointer"
                    style={{border:'1px dashed var(--bd)',background:'transparent',color:'var(--t3)',fontFamily:'Sora,system-ui,sans-serif'}}>+ Nova OS</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {view && (
        <Modal open={!!view} onClose={()=>setView(null)} title={`${view.number} — ${view.title}`}
          footer={<>
            <Btn onClick={()=>setView(null)} variant="secondary" size="md">Fechar</Btn>
            <Btn onClick={()=>openEdit(view)} variant="primary" size="md">✏️ Editar</Btn>
            {can('admin') && <Btn onClick={()=>del(view.id)} variant="danger" size="md">🗑️</Btn>}
          </>}>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge color={view.status==='done'?'green':view.status==='progress'?'amber':view.status==='cancelled'?'gray':'blue'}>{STATUS_INFO[view.status]?.label}</Badge>
            <span className="text-xs font-bold px-2 py-0.5 rounded-xl" style={{background:PRIO_COLOR[view.priority]+'22',color:PRIO_COLOR[view.priority]}}>{PRIO_LABEL[view.priority]}</span>
            {view.type && <Badge color="gray">{view.type}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            {[['Máquina',view.machine_name],['Responsável',view.resp_name],['Abertura',fmtD(view.open_date)],['Prazo',fmtD(view.due_date)],['Horas Estimadas',view.est_hours?view.est_hours+'h':null],['Setor',view.sector]].map(([k,v]) => v ? (
              <div key={String(k)}><div className="text-xs uppercase tracking-wider mb-0.5" style={{color:'var(--t3)',fontSize:'9px'}}>{k}</div><div className="font-semibold">{String(v)}</div></div>
            ) : null)}
          </div>
          {view.description && <div className="mb-3"><div className="text-xs uppercase tracking-wider mb-1" style={{color:'var(--t3)',fontSize:'9px'}}>Descrição</div><div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>{view.description}</div></div>}
          {view.parts_used && <div className="mb-3"><div className="text-xs uppercase tracking-wider mb-1" style={{color:'var(--t3)',fontSize:'9px'}}>Peças</div><div className="text-xs" style={{color:'var(--t2)'}}>{view.parts_used}</div></div>}
          {view.solution && <div className="rounded-xl p-2.5 mb-3" style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.25)'}}><div className="text-xs font-bold mb-1" style={{color:'var(--gn)'}}>✅ SOLUÇÃO</div><div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>{view.solution}</div></div>}
        </Modal>
      )}

      {/* Edit/Create Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar OS':'Nova Ordem de Serviço'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar OS</Btn></>}>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Título *" value={editing.title} onChange={(v:string)=>setEditing(e=>({...e,title:v}))} placeholder="Descrição da OS" className="col-span-2" />
          <Input label="Nº OS" value={editing.number} onChange={(v:string)=>setEditing(e=>({...e,number:v}))} />
          <Select label="Tipo" value={editing.type} onChange={(v:string)=>setEditing(e=>({...e,type:v}))} options={TYPES} />
        </div>
        <Select label="Máquina" value={editing.machine_id} onChange={(v:string)=>setEditing(e=>({...e,machine_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <Select label="Responsável" value={editing.resp_id} onChange={(v:string)=>setEditing(e=>({...e,resp_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...users.map(u=>({value:u.id,label:u.display_name||u.email}))]} />
        <div className="mb-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>Prioridade</label>
          <div className="flex gap-1.5">
            {PRIORITIES.map(p => (
              <button key={p.value} onClick={()=>setEditing(e=>({...e,priority:p.value as any}))}
                className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all"
                style={{background:editing.priority===p.value?PRIO_COLOR[p.value]+'22':'transparent',color:editing.priority===p.value?PRIO_COLOR[p.value]:'var(--t2)',borderColor:editing.priority===p.value?PRIO_COLOR[p.value]:'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Data Abertura" value={editing.open_date} onChange={(v:string)=>setEditing(e=>({...e,open_date:v}))} type="date" />
          <Input label="Prazo" value={editing.due_date} onChange={(v:string)=>setEditing(e=>({...e,due_date:v}))} type="date" />
          <Input label="Horas Estimadas" value={editing.est_hours} onChange={(v:string)=>setEditing(e=>({...e,est_hours:parseFloat(v)||undefined}))} type="number" placeholder="0.5" />
          <Input label="Setor" value={editing.sector} onChange={(v:string)=>setEditing(e=>({...e,sector:v}))} />
        </div>
        <Select label="Status" value={editing.status} onChange={(v:string)=>setEditing(e=>({...e,status:v as any}))} options={STATUSES} />
        <Textarea label="Descrição / Problema" value={editing.description} onChange={(v:string)=>setEditing(e=>({...e,description:v}))} placeholder="Descreva o problema..." />
        <Textarea label="Peças Necessárias" value={editing.parts_used} onChange={(v:string)=>setEditing(e=>({...e,parts_used:v}))} rows={2} placeholder="Ex: Filtro AR-001..." />
        {(editing.status==='done') && <Textarea label="Solução / O que foi feito" value={editing.solution} onChange={(v:string)=>setEditing(e=>({...e,solution:v}))} placeholder="Descreva a solução..." />}
      </Modal>
    </div>
  )
}
