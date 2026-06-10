'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
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
const TYPES = ['Preventiva','Corretiva','Preditiva','Inspeção','Lubrificação','Instalação','Fim de Semana','Emergencial','Outro']
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

// Check if today or given date is weekend
function isWeekend(dateStr?: string) {
  const d = dateStr ? new Date(dateStr+'T12:00:00') : new Date()
  return d.getDay() === 0 || d.getDay() === 6
}

export default function OSPage({ profile, can }: Props) {
  const [orders, setOrders]   = useState<WorkOrder[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [users, setUsers]     = useState<any[]>([])
  const [parts, setParts]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [view, setView]       = useState<WorkOrder|null>(null)
  const [editing, setEditing] = useState<Partial<WorkOrder>>({})
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('')
  const [counter, setCounter] = useState(1)
  const [partsUsedList, setPartsUsedList] = useState<any[]>([])
  const [selectedPartId, setSelectedPartId] = useState('')
  const [selectedPartQty, setSelectedPartQty] = useState(1)
  const { confirm, dialog }   = useConfirm()

  useEffect(() => { load(); loadMeta() }, [])

  async function load() {
    const { data } = await supabase.from('work_orders').select('*').order('created_at',{ascending:false})
    setOrders(data || [])
    setLoading(false)
  }

  async function loadMeta() {
    const [m, u, c, p] = await Promise.all([
      supabase.from('machines').select('id,name,code,icon'),
      supabase.from('profiles').select('id,display_name,email,shift,role'),
      supabase.from('os_counter').select('val').single(),
      supabase.from('parts').select('id,name,code,unit,stock,category'),
    ])
    setMachines(m.data||[])
    const userList = (u.data||[]).map((x:any) => {
      let name = x.display_name || ''
      // If empty or looks like UUID (contains multiple dashes and is long)
      if (!name || (name.includes('-') && name.length > 30)) {
        name = x.email?.split('@')[0] || 'Usuário'
      }
      return { ...x, display_name: name }
    }).sort((a:any,b:any) => a.display_name.localeCompare(b.display_name))
    setUsers(userList)
    setParts(p.data||[])
    if (c.data?.val) setCounter(c.data.val + 1)
  }

  function openNew(status='open', weekend=false) {
    const today = td()
    const type = weekend ? 'Fim de Semana' : 'Corretiva'
    setEditing({
      status: status as any,
      priority: weekend ? 'high' : 'medium',
      open_date: today,
      type,
      number: `OS-${String(counter).padStart(4,'0')}`,
    })
    setPartsUsedList([])
    setView(null); setModal(true)
  }

  function openEdit(o: WorkOrder) {
    setEditing({...o})
    // Parse parts_used back to list if JSON
    try {
      const parsed = JSON.parse(o.parts_used||'[]')
      if (Array.isArray(parsed)) setPartsUsedList(parsed)
      else setPartsUsedList([])
    } catch { setPartsUsedList([]) }
    setView(null); setModal(true)
  }

  function addPartToOS() {
    if (!selectedPartId) { toast.error('Selecione uma peça'); return }
    const part = parts.find(p => p.id === selectedPartId)
    if (!part) return
    if (selectedPartQty > part.stock) { toast.error(`Estoque insuficiente! Disponível: ${part.stock} ${part.unit}`); return }
    const existing = partsUsedList.find(x => x.part_id === selectedPartId)
    if (existing) {
      setPartsUsedList(list => list.map(x => x.part_id === selectedPartId ? {...x, qty: x.qty + selectedPartQty} : x))
    } else {
      setPartsUsedList(list => [...list, { part_id: part.id, part_name: part.name, part_code: part.code, unit: part.unit, qty: selectedPartQty }])
    }
    setSelectedPartId(''); setSelectedPartQty(1)
  }

  function removePartFromOS(partId: string) {
    setPartsUsedList(list => list.filter(x => x.part_id !== partId))
  }

  async function deductPartsFromStock(osList: any[], osId: string, osNumber: string) {
    for (const item of osList) {
      const part = parts.find(p => p.id === item.part_id)
      if (!part) continue
      const newStock = Math.max(0, (part.stock || 0) - item.qty)
      await supabase.from('parts').update({ stock: newStock }).eq('id', item.part_id)
      await supabase.from('stock_movements').insert({
        part_id: item.part_id,
        part_name: item.part_name,
        part_code: item.part_code,
        type: 'out',
        quantity: item.qty,
        stock_after: newStock,
        reason: `Baixa automática OS ${osNumber}`,
        os_id: osId,
        created_by: profile?.display_name || profile?.email,
        created_at: new Date().toISOString(),
      })
    }
    // Reload parts
    const { data } = await supabase.from('parts').select('id,name,code,unit,stock,category')
    setParts(data || [])
  }

  async function save() {
    if (!editing.title) { toast.error('Informe o título'); return }
    const mach = machines.find(m => m.id === editing.machine_id)
    const usr  = users.find(u => u.id === editing.resp_id)
    const partsJson = JSON.stringify(partsUsedList)
    const obj = {
      ...editing,
      machine_name: mach?.name,
      machine_code: mach?.code,
      resp_name: usr?.display_name || usr?.email,
      parts_used: partsJson,
    }

    try {
      if (editing.id) {
        const wasNotDone = orders.find(o => o.id === editing.id)?.status !== 'done'
        const isNowDone  = editing.status === 'done'

        const { error } = await supabase.from('work_orders').update(obj).eq('id', editing.id)
        if (error) throw error

        // Auto-deduct stock when closing OS
        if (wasNotDone && isNowDone && partsUsedList.length > 0) {
          await deductPartsFromStock(partsUsedList, editing.id, editing.number || '')
          toast.success(`OS concluída! ${partsUsedList.length} peça(s) baixadas do estoque ✅`)
        } else {
          toast.success('OS atualizada ✅')
        }
      } else {
        const { data, error } = await supabase.from('work_orders').insert({
          ...obj,
          created_by: profile?.display_name || profile?.email,
        }).select().single()
        if (error) throw error
        await supabase.from('os_counter').upsert({ id:1, val: counter })
        setCounter(c => c + 1)

        // If creating already as done, deduct stock
        if (editing.status === 'done' && partsUsedList.length > 0 && data) {
          await deductPartsFromStock(partsUsedList, data.id, obj.number || '')
        }
        toast.success(`OS ${obj.number} criada ✅`)
      }
      setModal(false); load()
    } catch(e: any) { toast.error('Erro: ' + e.message) }
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
  const todayIsWeekend = isWeekend()
  const byStatus: Record<string,WorkOrder[]> = { open:[], progress:[], done:[], cancelled:[] }
  filtered.forEach(o => { const k = o.status || 'open'; if(byStatus[k]) byStatus[k].push(o) })

  return (
    <div>
      {dialog}
      <div className="flex gap-2 mb-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar OS..."
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
          onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
        {todayIsWeekend && (
          <Btn onClick={()=>openNew('open',true)} size="sm" variant="secondary">🗓️ Fim Semana</Btn>
        )}
        <Btn onClick={()=>openNew()} size="sm" variant="primary">+ Nova OS</Btn>
      </div>

      {/* Weekend alert */}
      {todayIsWeekend && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl mb-3" style={{background:'rgba(167,139,250,.1)',border:'1px solid rgba(167,139,250,.4)'}}>
          <span className="text-base">🗓️</span>
          <div className="text-xs font-semibold" style={{color:'#a78bfa'}}>Hoje é fim de semana — OS de fim de semana disponíveis</div>
        </div>
      )}

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
                  const isWknd = o.type === 'Fim de Semana'
                  let partsCount = 0
                  try { const p = JSON.parse(o.parts_used||'[]'); if (Array.isArray(p)) partsCount = p.length } catch {}
                  return (
                    <div key={o.id} onClick={()=>setView(o)} className="rounded-xl p-2 cursor-pointer transition-all"
                      style={{background:'var(--bg2)',border:`1px solid ${late?'rgba(239,68,68,.4)':isWknd?'rgba(167,139,250,.4)':'var(--bd)'}`,boxShadow:late?'0 0 8px rgba(239,68,68,.1)':isWknd?'0 0 8px rgba(167,139,250,.1)':'none'}}>
                      <div className="text-xs" style={{color:'var(--t3)',fontFamily:'monospace'}}>{o.number} {isWknd&&'🗓️'}</div>
                      <div className="text-xs font-semibold mt-0.5 leading-tight">{o.title}</div>
                      <div className="text-xs mt-1" style={{color:'var(--t2)'}}>⚙️ {o.machine_name||'—'}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-lg" style={{background:PRIO_COLOR[o.priority]+'22',color:PRIO_COLOR[o.priority],fontSize:'9px'}}>
                          {PRIO_LABEL[o.priority]||'—'}
                        </span>
                        {late ? <span className="text-xs font-bold" style={{color:'var(--rd)',fontSize:'9px'}}>⚠️ Atrasada</span>
                               : o.due_date ? <span className="text-xs" style={{color:'var(--t3)',fontSize:'9px'}}>📅 {fmtD(o.due_date)}</span> : null}
                      </div>
                      {partsCount > 0 && <div className="text-xs mt-1" style={{color:'var(--cy)',fontSize:'9px'}}>📦 {partsCount} peça(s)</div>}
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
            {view.type === 'Fim de Semana' && <Badge color="purple">🗓️ Fim de Semana</Badge>}
            {view.type && view.type !== 'Fim de Semana' && <Badge color="gray">{view.type}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            {[['Máquina',view.machine_name],['Responsável',view.resp_name],['Abertura',fmtD(view.open_date)],['Prazo',fmtD(view.due_date)],['Setor',view.sector]].map(([k,v]) => v ? (
              <div key={String(k)}><div className="text-xs uppercase tracking-wider mb-0.5" style={{color:'var(--t3)',fontSize:'9px'}}>{k}</div><div className="font-semibold">{String(v)}</div></div>
            ) : null)}
          </div>
          {view.description && <div className="mb-3"><div className="text-xs uppercase tracking-wider mb-1" style={{color:'var(--t3)',fontSize:'9px'}}>Descrição</div><div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>{view.description}</div></div>}
          {/* Parts used */}
          {(() => { try { const p = JSON.parse(view.parts_used||'[]'); if(Array.isArray(p)&&p.length>0) return (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wider mb-2" style={{color:'var(--t3)',fontSize:'9px'}}>📦 Peças Utilizadas</div>
              {p.map((item:any,i:number) => (
                <div key={i} className="flex justify-between py-1.5 text-xs" style={{borderBottom:'1px solid var(--bd)'}}>
                  <span>{item.part_name} <span style={{color:'var(--t3)'}}>({item.part_code})</span></span>
                  <span className="font-bold" style={{color:'var(--cy)'}}>{item.qty} {item.unit}</span>
                </div>
              ))}
            </div>
          )} catch {} return null })()}
          {view.solution && <div className="rounded-xl p-2.5 mb-3" style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.25)'}}><div className="text-xs font-bold mb-1" style={{color:'var(--gn)'}}>✅ SOLUÇÃO</div><div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>{view.solution}</div></div>}
        </Modal>
      )}

      {/* Edit/Create Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar OS':'Nova Ordem de Serviço'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar OS</Btn></>}>

        {/* Weekend badge */}
        {editing.type === 'Fim de Semana' && (
          <div className="flex items-center gap-2 p-2 rounded-xl mb-3" style={{background:'rgba(167,139,250,.12)',border:'1px solid rgba(167,139,250,.4)'}}>
            <span>🗓️</span><span className="text-xs font-bold" style={{color:'#a78bfa'}}>OS de Fim de Semana</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Título *" value={editing.title} onChange={(v:string)=>setEditing(e=>({...e,title:v}))} placeholder="Descrição da OS" className="col-span-2" />
          <Input label="Nº OS" value={editing.number} onChange={(v:string)=>setEditing(e=>({...e,number:v}))} />
          <Select label="Tipo" value={editing.type} onChange={(v:string)=>setEditing(e=>({...e,type:v}))} options={TYPES} />
        </div>
        <Select label="Máquina" value={editing.machine_id} onChange={(v:string)=>setEditing(e=>({...e,machine_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <Select label="Responsável pela Manutenção" value={editing.resp_id} onChange={(v:string)=>{
            const u = users.find(x=>x.id===v)
            setEditing(e=>({...e, resp_id:v, resp_name: u?.display_name||u?.email||''}))
          }}
          options={[{value:'',label:'Selecione o responsável...'}, ...users.map(u=>({value:u.id,label:`${u.display_name}${u.shift?' — Turno '+u.shift:''}`}))]} />
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
          <Input label="Setor" value={editing.sector} onChange={(v:string)=>setEditing(e=>({...e,sector:v}))} />
        </div>
        <Select label="Status" value={editing.status} onChange={(v:string)=>setEditing(e=>({...e,status:v as any}))} options={STATUSES} />
        <Textarea label="Descrição / Problema" value={editing.description} onChange={(v:string)=>setEditing(e=>({...e,description:v}))} placeholder="Descreva o problema..." />

        {/* Parts selection */}
        <div className="rounded-xl p-2.5 mb-2.5" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>
          <div className="text-xs font-bold mb-2" style={{color:'var(--cy)'}}>📦 Peças Utilizadas <span style={{color:'var(--t3)',fontWeight:400}}>(baixa automática ao concluir)</span></div>
          {partsUsedList.map(item => (
            <div key={item.part_id} className="flex items-center justify-between py-1.5" style={{borderBottom:'1px solid var(--bd)'}}>
              <div className="text-xs">{item.part_name} <span style={{color:'var(--t3)'}}>({item.part_code})</span></div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{color:'var(--cy)'}}>{item.qty} {item.unit}</span>
                <button onClick={()=>removePartFromOS(item.part_id)} style={{background:'none',border:'none',color:'var(--rd)',cursor:'pointer',fontSize:'14px',lineHeight:1}}>×</button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <select value={selectedPartId} onChange={e=>setSelectedPartId(e.target.value)}
              className="flex-1 rounded-xl px-2 py-1.5 text-xs outline-none"
              style={{background:'var(--s3)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
              <option value="">Selecionar peça...</option>
              {parts.filter(p=>p.stock>0).map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit})</option>)}
            </select>
            <input type="number" min="1" value={selectedPartQty}
              onChange={e=>setSelectedPartQty(parseInt(e.target.value)||1)}
              className="w-14 rounded-xl px-2 py-1.5 text-xs outline-none text-center"
              style={{background:'var(--s3)',border:'1px solid var(--bd)',color:'var(--t1)'}} />
            <Btn onClick={addPartToOS} size="sm" variant="primary">+ Add</Btn>
          </div>
        </div>

        {editing.status==='done' && <Textarea label="Solução / O que foi feito" value={editing.solution} onChange={(v:string)=>setEditing(e=>({...e,solution:v}))} placeholder="Descreva a solução..." />}
      </Modal>
    </div>
  )
}
