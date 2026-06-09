'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Part, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
const CATS = ['Rolamento','Correia','Corrente','Sensor','Motor','Bomba','Filtro','Válvula','Óleo','Eletrônico','Vedação','Outro']
const UNITS = [{value:'un',label:'Unidade'},{value:'kg',label:'Kg'},{value:'m',label:'Metro'},{value:'l',label:'Litro'},{value:'cj',label:'Conjunto'}]
const PO_STATUS = [{value:'pending',label:'⏳ Pendente'},{value:'approved',label:'✅ Aprovado'},{value:'ordered',label:'📦 Pedido'},{value:'received',label:'✔️ Recebido'},{value:'cancelled',label:'❌ Cancelado'}]
const PO_COLOR: Record<string,string> = {pending:'amber',approved:'green',ordered:'blue',received:'green',cancelled:'gray'}
const MOVE_TYPES = [{value:'in',label:'📥 Entrada'},{value:'out',label:'📤 Saída'},{value:'adjust',label:'🔧 Ajuste'}]

export default function PartsPage({ profile, can }: Props) {
  const [parts, setParts]   = useState<Part[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [osList, setOsList] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoad]  = useState(true)
  const [tab, setTab]       = useState('parts')
  const [modal, setModal]   = useState(false)
  const [modalPO, setModalPO] = useState(false)
  const [modalMove, setModalMove] = useState(false)
  const [editing, setEdit]  = useState<any>({})
  const [editPO, setEditPO] = useState<any>({})
  const [move, setMove]     = useState<any>({})
  const [search, setSearch] = useState('')
  const [cat, setCat]       = useState('all')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [tab])

  async function load() {
    const [p, s] = await Promise.all([
      supabase.from('parts').select('*').order('name'),
      supabase.from('suppliers').select('id,name,razao_social'),
    ])
    setParts(p.data||[]); setSuppliers(s.data||[])
    if (tab==='orders') {
      const { data } = await supabase.from('purchase_orders').select('*').order('created_at',{ascending:false})
      setOrders(data||[])
    }
    if (tab==='movements') {
      const { data } = await supabase.from('stock_movements').select('*').order('created_at',{ascending:false}).limit(50)
      setMovements(data||[])
    }
    const { data: os } = await supabase.from('work_orders').select('id,number,title,status').neq('status','done').neq('status','cancelled')
    setOsList(os||[])
    setLoad(false)
  }

  async function savePart() {
    if (!editing.name||!editing.code) { toast.error('Informe nome e código'); return }
    try {
      if (editing.id) {
        const { error } = await supabase.from('parts').update(editing).eq('id', editing.id)
        if (error) throw error; toast.success('Peça atualizada ✅')
      } else {
        const { error } = await supabase.from('parts').insert({ ...editing, created_at: new Date().toISOString() })
        if (error) throw error; toast.success('Peça cadastrada ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function savePO() {
    if (!editPO.part_id) { toast.error('Selecione a peça'); return }
    if (!editPO.quantity||editPO.quantity<=0) { toast.error('Informe a quantidade'); return }
    try {
      const part = parts.find(p=>p.id===editPO.part_id)
      const obj = { ...editPO, part_name: part?.name, part_code: part?.code, status: editPO.status||'pending', created_by: profile?.display_name||profile?.email, created_at: new Date().toISOString() }
      if (editPO.id) {
        const { error } = await supabase.from('purchase_orders').update(obj).eq('id', editPO.id)
        if (error) throw error
        // If received, update stock
        if (editPO.status==='received' && editPO.part_id) {
          const part2 = parts.find(p=>p.id===editPO.part_id)
          if (part2) {
            await supabase.from('parts').update({ stock: (part2.stock||0) + (editPO.quantity||0) }).eq('id', editPO.part_id)
            await supabase.from('stock_movements').insert({ part_id: editPO.part_id, part_name: part2.name, type:'in', quantity: editPO.quantity, reason: `Recebimento PO #${editPO.id?.slice(-6)}`, created_by: profile?.display_name, created_at: new Date().toISOString() })
          }
        }
      } else {
        const { error } = await supabase.from('purchase_orders').insert(obj)
        if (error) throw error
      }
      toast.success('Pedido salvo ✅'); setModalPO(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function saveMove() {
    if (!move.part_id) { toast.error('Selecione a peça'); return }
    if (!move.quantity||move.quantity<=0) { toast.error('Informe a quantidade'); return }
    const part = parts.find(p=>p.id===move.part_id)
    if (!part) return
    let newStock = part.stock||0
    if (move.type==='in') newStock += move.quantity
    else if (move.type==='out') {
      if (move.quantity > newStock) { toast.error(`Estoque insuficiente! Atual: ${newStock} ${part.unit}`); return }
      newStock -= move.quantity
    } else newStock = move.quantity // adjust
    try {
      await supabase.from('parts').update({ stock: newStock }).eq('id', move.part_id)
      await supabase.from('stock_movements').insert({ ...move, part_name: part.name, part_code: part.code, stock_after: newStock, created_by: profile?.display_name||profile?.email, created_at: new Date().toISOString() })
      toast.success(`Estoque atualizado: ${newStock} ${part.unit} ✅`); setModalMove(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function withdrawForOS(partId: string, osId: string, qty: number) {
    const part = parts.find(p=>p.id===partId)
    const os = osList.find(o=>o.id===osId)
    if (!part||!os) return
    if (qty > (part.stock||0)) { toast.error('Estoque insuficiente'); return }
    const newStock = (part.stock||0) - qty
    await supabase.from('parts').update({ stock: newStock }).eq('id', partId)
    await supabase.from('stock_movements').insert({ part_id: partId, part_name: part.name, type:'out', quantity: qty, reason: `Baixa OS ${os.number}`, os_id: osId, stock_after: newStock, created_by: profile?.display_name, created_at: new Date().toISOString() })
    // Update OS parts_used
    const { data: osData } = await supabase.from('work_orders').select('parts_used').eq('id', osId).single()
    const existing = osData?.parts_used||''
    const newParts = existing ? `${existing}\n${qty}x ${part.name} (${part.code})` : `${qty}x ${part.name} (${part.code})`
    await supabase.from('work_orders').update({ parts_used: newParts }).eq('id', osId)
    toast.success(`${qty}x ${part.name} baixado na OS ${os.number} ✅`); load()
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta peça?')) return
    await supabase.from('parts').delete().eq('id', id)
    toast.success('Excluída'); load()
  }

  const filtered = parts.filter(p => {
    const q = search.toLowerCase()
    return (cat==='all'||p.category===cat) && (!q||p.name.toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q))
  })
  const lowStock = parts.filter(p => p.stock <= p.min_stock).length

  return (
    <div>
      {dialog}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
        {[{k:'parts',l:'📦 Peças'},{k:'orders',l:'🛒 Pedidos'},{k:'movements',l:'📊 Movimentos'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}{t.k==='parts'&&lowStock>0?` ⚠️${lowStock}`:''}
          </button>
        ))}
      </div>

      {/* PARTS TAB */}
      {tab==='parts' && (
        <>
          {lowStock>0&&<div className="flex items-center gap-2 p-2.5 rounded-xl mb-3" style={{background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.3)'}}><span>⚠️</span><div className="text-xs font-semibold" style={{color:'var(--am)'}}>{lowStock} peça(s) com estoque baixo!</div></div>}
          <div className="flex gap-2 mb-2">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar peça..."
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
              style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
              onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
            <Btn onClick={()=>setModalMove(true)} size="sm" variant="secondary">± Estoque</Btn>
            {can('mach')&&<Btn onClick={()=>{setEdit({unit:'un',stock:0,min_stock:1});setModal(true)}} size="sm" variant="primary">+ Peça</Btn>}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
            {[{value:'all',label:'Todas'},...CATS.map(c=>({value:c,label:c}))].map(c=>(
              <button key={c.value} onClick={()=>setCat(c.value)} className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer"
                style={{background:cat===c.value?'var(--cy)':'transparent',color:cat===c.value?'#000':'var(--t2)',borderColor:cat===c.value?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
                {c.label}
              </button>
            ))}
          </div>
          {loading?<div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div>:filtered.length===0?<Empty icon="📦" text="Nenhuma peça"/>:(
            <div className="flex flex-col gap-2">
              {filtered.map(p=>{
                const low=p.stock<=p.min_stock
                return (
                  <div key={p.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:`1px solid ${low?'rgba(245,158,11,.4)':'var(--bd)'}`}}>
                    <div className="flex items-center gap-2">
                      <div className="text-xl flex-shrink-0">📦</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="text-xs font-semibold truncate">{p.name}</div>
                          {low&&<Badge color="amber">Baixo</Badge>}
                        </div>
                        <div className="text-xs font-mono mt-0.5" style={{color:'var(--t3)'}}>{p.code}</div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>
                          <span style={{color:low?'var(--am)':'var(--gn)',fontWeight:600}}>{p.stock} {p.unit}</span> · Mín: {p.min_stock} · {p.category}
                          {p.location&&` · 📍${p.location}`}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {p.unit_value&&<div className="text-xs font-bold" style={{color:'var(--cy)'}}>R${p.unit_value}</div>}
                        <button onClick={()=>{setMove({part_id:p.id,type:'out',quantity:1,reason:''});setModalMove(true)}} className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(0,212,255,.1)',color:'var(--cy)',border:'1px solid rgba(0,212,255,.2)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif'}}>± Mov</button>
                        {can('mach')&&<button onClick={()=>{setEdit({...p});setModal(true)}} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>}
                        {can('mach')&&<button onClick={()=>del(p.id)} style={{background:'none',border:'none',color:'var(--rd)',cursor:'pointer',fontSize:'14px'}}>🗑️</button>}
                      </div>
                    </div>
                    {/* OS withdrawal */}
                    {osList.length>0&&p.stock>0&&(
                      <div className="mt-2 pt-2" style={{borderTop:'1px solid var(--bd)'}}>
                        <div className="text-xs mb-1.5 font-semibold" style={{color:'var(--t3)'}}>🔗 Baixar para OS:</div>
                        <div className="flex gap-1.5 overflow-x-auto" style={{scrollbarWidth:'none'}}>
                          {osList.slice(0,4).map(os=>(
                            <button key={os.id} onClick={()=>withdrawForOS(p.id,os.id,1)}
                              className="flex-shrink-0 text-xs px-2 py-1 rounded-lg cursor-pointer"
                              style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t2)',fontFamily:'Sora,system-ui,sans-serif'}}>
                              {os.number}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* PURCHASE ORDERS TAB */}
      {tab==='orders' && (
        <>
          <SH label={`Pedidos de Compra (${orders.length})`} action={<Btn onClick={()=>{setEditPO({status:'pending',quantity:1,date_requested:td()});setModalPO(true)}} size="sm" variant="primary">+ Pedido</Btn>} />
          {orders.length===0?<Empty icon="🛒" text="Nenhum pedido de compra"/>:(
            <div className="flex flex-col gap-2">
              {orders.map(o=>{
                const part=parts.find(p=>p.id===o.part_id)
                const sup=suppliers.find(s=>s.id===o.supplier_id)
                return (
                  <div key={o.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="text-xs font-bold">{o.part_name||part?.name}</div>
                          <Badge color={PO_COLOR[o.status] as any}>{PO_STATUS.find(s=>s.value===o.status)?.label||o.status}</Badge>
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>
                          Qtd: <strong>{o.quantity} {part?.unit||'un'}</strong>
                          {sup&&` · ${sup.razao_social||sup.name}`}
                          {o.unit_value&&` · R$ ${o.unit_value}/un`}
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>Solicitado: {fmtD(o.date_requested)}{o.date_expected&&` · Previsto: ${fmtD(o.date_expected)}`}</div>
                        {o.notes&&<div className="text-xs mt-1" style={{color:'var(--t3)'}}>{o.notes}</div>}
                      </div>
                      {can('mach')&&<button onClick={()=>{setEditPO({...o});setModalPO(true)}} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px',flexShrink:0}}>✏️</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* MOVEMENTS TAB */}
      {tab==='movements' && (
        <>
          <SH label={`Movimentos de Estoque (${movements.length})`} action={<Btn onClick={()=>{setMove({type:'in',quantity:1,date:td()});setModalMove(true)}} size="sm" variant="primary">+ Mov.</Btn>} />
          {movements.length===0?<Empty icon="📊" text="Nenhum movimento registrado"/>:(
            <div className="flex flex-col gap-2">
              {movements.map(m=>(
                <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:`1px solid ${m.type==='in'?'rgba(16,185,129,.25)':m.type==='out'?'rgba(239,68,68,.25)':'rgba(245,158,11,.25)'}`}}>
                  <span className="text-base flex-shrink-0">{m.type==='in'?'📥':m.type==='out'?'📤':'🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{m.part_name}</div>
                    <div className="text-xs" style={{color:'var(--t2)'}}>{m.reason||'—'} · {fmtD(m.created_at?.split('T')[0])}</div>
                    {m.os_id&&<div className="text-xs" style={{color:'var(--cy)'}}>🔗 OS vinculada</div>}
                  </div>
                  <div className="text-sm font-bold flex-shrink-0" style={{color:m.type==='in'?'var(--gn)':m.type==='out'?'var(--rd)':'var(--am)'}}>
                    {m.type==='in'?'+':m.type==='out'?'-':'='}{m.quantity}
                  </div>
                  {m.stock_after!=null&&<div className="text-xs flex-shrink-0" style={{color:'var(--t3)'}}>={m.stock_after}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Part Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Peça':'Nova Peça'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={savePart} variant="primary" size="md">Salvar</Btn></>}>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Código *" value={editing.code} onChange={(v:string)=>setEdit((e:any)=>({...e,code:v}))} placeholder="ROL-22218" />
          <Select label="Categoria" value={editing.category} onChange={(v:string)=>setEdit((e:any)=>({...e,category:v}))} options={CATS} />
        </div>
        <Input label="Nome *" value={editing.name} onChange={(v:string)=>setEdit((e:any)=>({...e,name:v}))} />
        <div className="grid grid-cols-3 gap-x-2">
          <Input label="Estoque" value={editing.stock} onChange={(v:string)=>setEdit((e:any)=>({...e,stock:parseFloat(v)||0}))} type="number" />
          <Input label="Mín." value={editing.min_stock} onChange={(v:string)=>setEdit((e:any)=>({...e,min_stock:parseFloat(v)||1}))} type="number" />
          <Select label="Un." value={editing.unit} onChange={(v:string)=>setEdit((e:any)=>({...e,unit:v}))} options={UNITS} />
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Valor R$" value={editing.unit_value} onChange={(v:string)=>setEdit((e:any)=>({...e,unit_value:parseFloat(v)||undefined}))} type="number" />
          <Input label="Localização" value={editing.location} onChange={(v:string)=>setEdit((e:any)=>({...e,location:v}))} />
        </div>
        <Input label="Fornecedor" value={editing.supplier} onChange={(v:string)=>setEdit((e:any)=>({...e,supplier:v}))} />
      </Modal>

      {/* Purchase Order Modal */}
      <Modal open={modalPO} onClose={()=>setModalPO(false)} title={editPO.id?'Editar Pedido':'Novo Pedido de Compra'}
        footer={<><Btn onClick={()=>setModalPO(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={savePO} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Peça *" value={editPO.part_id} onChange={(v:string)=>setEditPO((e:any)=>({...e,part_id:v}))}
          options={[{value:'',label:'Selecione...'},...parts.map(p=>({value:p.id,label:`${p.code} — ${p.name} (${p.stock} ${p.unit})`}))]} />
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Quantidade *" value={editPO.quantity} onChange={(v:string)=>setEditPO((e:any)=>({...e,quantity:parseFloat(v)||1}))} type="number" />
          <Input label="Valor Unit. R$" value={editPO.unit_value} onChange={(v:string)=>setEditPO((e:any)=>({...e,unit_value:parseFloat(v)||undefined}))} type="number" />
          <Input label="Data Solicitação" value={editPO.date_requested} onChange={(v:string)=>setEditPO((e:any)=>({...e,date_requested:v}))} type="date" />
          <Input label="Previsão Entrega" value={editPO.date_expected} onChange={(v:string)=>setEditPO((e:any)=>({...e,date_expected:v}))} type="date" />
        </div>
        <Select label="Fornecedor" value={editPO.supplier_id} onChange={(v:string)=>setEditPO((e:any)=>({...e,supplier_id:v}))}
          options={[{value:'',label:'Nenhum'},...suppliers.map(s=>({value:s.id,label:s.razao_social||s.name}))]} />
        <Select label="Status" value={editPO.status||'pending'} onChange={(v:string)=>setEditPO((e:any)=>({...e,status:v}))} options={PO_STATUS} />
        <Textarea label="Observações" value={editPO.notes} onChange={(v:string)=>setEditPO((e:any)=>({...e,notes:v}))} rows={2} />
      </Modal>

      {/* Stock Movement Modal */}
      <Modal open={modalMove} onClose={()=>setModalMove(false)} title="Movimentação de Estoque"
        footer={<><Btn onClick={()=>setModalMove(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveMove} variant="primary" size="md">Confirmar</Btn></>}>
        <Select label="Peça *" value={move.part_id} onChange={(v:string)=>setMove((e:any)=>({...e,part_id:v}))}
          options={[{value:'',label:'Selecione...'},...parts.map(p=>({value:p.id,label:`${p.name} (${p.stock} ${p.unit})`}))]} />
        <div className="mb-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>Tipo</label>
          <div className="flex gap-1.5">
            {MOVE_TYPES.map(t=>(
              <button key={t.value} onClick={()=>setMove((e:any)=>({...e,type:t.value}))}
                className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer border"
                style={{background:move.type===t.value?'var(--cy)':'transparent',color:move.type===t.value?'#000':'var(--t2)',borderColor:move.type===t.value?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Quantidade *" value={move.quantity} onChange={(v:string)=>setMove((e:any)=>({...e,quantity:parseFloat(v)||1}))} type="number" />
          <Input label="Data" value={move.date||td()} onChange={(v:string)=>setMove((e:any)=>({...e,date:v}))} type="date" />
        </div>
        <Select label="Vincular a OS" value={move.os_id} onChange={(v:string)=>setMove((e:any)=>({...e,os_id:v}))}
          options={[{value:'',label:'Nenhuma'},...osList.map(o=>({value:o.id,label:`${o.number} — ${o.title?.slice(0,30)}`}))]} />
        <Textarea label="Motivo / Observação" value={move.reason} onChange={(v:string)=>setMove((e:any)=>({...e,reason:v}))} rows={2} placeholder="Ex: Utilizado na manutenção..." />
      </Modal>
    </div>
  )
}
