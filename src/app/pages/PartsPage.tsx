'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SelectComCadastro, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Part, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const CATS = ['Rolamento','Correia','Corrente','Sensor','Motor','Bomba','Filtro','Válvula','Óleo','Eletrônico','Vedação','Outro']
const UNITS = [{value:'un',label:'Unidade'},{value:'kg',label:'Kg'},{value:'m',label:'Metro'},{value:'l',label:'Litro'},{value:'cj',label:'Conjunto'}]
const PO_STATUS = [{value:'pending',label:'⏳ Pendente'},{value:'approved',label:'✅ Aprovado'},{value:'ordered',label:'📦 Pedido'},{value:'received',label:'✔️ Recebido'},{value:'cancelled',label:'❌ Cancelado'}]
const PO_COLOR: Record<string,string> = {pending:'amber',approved:'green',ordered:'blue',received:'green',cancelled:'gray'}
const MOVE_TYPES = [{value:'in',label:'📥 Entrada'},{value:'out',label:'📤 Saída'},{value:'adjust',label:'🔧 Ajuste'}]

const CAT_ICONS: Record<string,string> = {
  'Rolamento':'⚙️','Correia':'〰️','Corrente':'🔗','Sensor':'📡',
  'Motor':'⚡','Bomba':'💧','Filtro':'🔲','Válvula':'🔧',
  'Óleo':'🛢️','Eletrônico':'💡','Vedação':'🔴','Outro':'📦'
}

export default function PartsPage({ profile, can }: Props) {
  const [parts, setParts]     = useState<Part[]>([])
  const [orders, setOrders]   = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [osList, setOsList]   = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoad]    = useState(true)
  const [tab, setTab]         = useState('catalog')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [modal, setModal]     = useState(false)
  const [modalPO, setModalPO] = useState(false)
  const [modalMove, setModalMove] = useState(false)
  const [editing, setEdit]    = useState<any>({})
  const [editPO, setEditPO]   = useState<any>({})
  const [move, setMove]       = useState<any>({type:'in',quantity:1})
  const [search, setSearch]   = useState('')
  const { confirm, dialog }   = useConfirm()

  useEffect(() => { load() }, [tab])

  async function load() {
    const [p, s, os] = await Promise.all([
      supabase.from('parts').select('*').order('category,name'),
      supabase.from('cadastros').select('id,nome_razao').eq('is_fornecedor',true).eq('status',true),
      supabase.from('work_orders').select('id,number,title,status').neq('status','done').neq('status','cancelled'),
    ])
    setParts(p.data||[]); setSuppliers(s.data||[]); setOsList(os.data||[])
    if (tab==='orders') {
      const { data } = await supabase.from('purchase_orders').select('*').order('created_at',{ascending:false})
      setOrders(data||[])
    }
    if (tab==='movements') {
      const { data } = await supabase.from('stock_movements').select('*').order('created_at',{ascending:false}).limit(100)
      setMovements(data||[])
    }
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

  async function saveMove() {
    if (!move.part_id) { toast.error('Selecione a peça'); return }
    if (!move.quantity||move.quantity<=0) { toast.error('Informe a quantidade'); return }
    const part = parts.find(p=>p.id===move.part_id)
    if (!part) return
    let newStock = part.stock||0
    if (move.type==='in') newStock += Number(move.quantity)
    else if (move.type==='out') {
      if (Number(move.quantity) > newStock) { toast.error(`Estoque insuficiente! Atual: ${newStock} ${part.unit}`); return }
      newStock -= Number(move.quantity)
    } else newStock = Number(move.quantity)
    try {
      const { error: e1 } = await supabase.from('parts').update({ stock: newStock }).eq('id', move.part_id)
      if (e1) { toast.error('Erro: '+e1.message); return }
      const { error: e2 } = await supabase.from('stock_movements').insert({
        ...move,
        part_name: part.name, part_code: part.code,
        stock_after: newStock,
        created_by: profile?.display_name||profile?.email,
        created_at: new Date().toISOString()
      })
      toast.success(`Estoque: ${newStock} ${part.unit} ✅`)
      setMove({type:'in',quantity:1}); setModalMove(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function savePO() {
    if (!editPO.part_id||!editPO.quantity) { toast.error('Preencha peça e quantidade'); return }
    const part = parts.find(p=>p.id===editPO.part_id)
    const obj = { ...editPO, part_name: part?.name, part_code: part?.code, status: editPO.status||'pending', created_by: profile?.display_name, created_at: new Date().toISOString() }
    try {
      if (editPO.id) {
        const { error: ePo } = await supabase.from('purchase_orders').update(obj).eq('id', editPO.id)
        if (ePo) { toast.error('Erro: '+ePo.message); return }
        // If received, auto-update stock
        if (editPO.status==='received') {
          const newStock = (part?.stock||0) + Number(editPO.quantity)
          const { error: e3 } = await supabase.from('parts').update({ stock: newStock }).eq('id', editPO.part_id)
          if (e3) toast.error('Erro estoque: '+e3.message)
          const { error: e4 } = await supabase.from('stock_movements').insert({ part_id: editPO.part_id, part_name: part?.name, type:'in', quantity: editPO.quantity, reason: 'Recebimento de pedido de compra', stock_after: newStock, created_by: profile?.display_name, created_at: new Date().toISOString() })
          if (e4) toast.error('Erro movimento: '+e4.message)
          toast.success('Pedido recebido! Estoque atualizado ✅')
        } else { toast.success('Pedido atualizado ✅') }
      } else {
        const { error: ePo2 } = await supabase.from('purchase_orders').insert(obj)
        if (ePo2) { toast.error('Erro: '+ePo2.message); return }
        toast.success('Pedido criado ✅')
      }
      setModalPO(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta peça?')) return
    const { error: eDel } = await supabase.from('parts').delete().eq('id', id)
    if (eDel) { toast.error('Erro: '+eDel.message); return }
    toast.success('Excluída'); load()
  }

  // Category summary
  const catSummary = CATS.map(cat => {
    const catParts = parts.filter(p => p.category === cat)
    const totalStock = catParts.reduce((s, p) => s + (p.stock||0), 0)
    const lowCount = catParts.filter(p => p.stock <= p.min_stock).length
    return { cat, count: catParts.length, totalStock, lowCount }
  }).filter(c => c.count > 0)

  const allCategories = ['Todos', ...catSummary.map(c => c.cat)]
  const lowStock = parts.filter(p => p.stock <= p.min_stock).length

  const filteredParts = parts.filter(p => {
    const q = search.toLowerCase()
    const matchCat = activeCategory === 'Todos' || p.category === activeCategory
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  return (
    <div>
      {dialog}

      {/* Main tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
        {[
          {k:'catalog',  l:`📦 Catálogo${lowStock>0?` ⚠️${lowStock}`:''}` },
          {k:'orders',   l:'🛒 Pedidos'},
          {k:'movements',l:'📊 Movimentos'},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── CATALOG TAB ── */}
      {tab==='catalog' && (
        <>
          {/* Category cards summary */}
          {catSummary.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'var(--t3)'}}>Estoque por Categoria</div>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                {catSummary.map(c => (
                  <div key={c.cat} onClick={()=>setActiveCategory(c.cat)}
                    className="flex-shrink-0 rounded-xl p-2.5 cursor-pointer transition-all"
                    style={{background: activeCategory===c.cat?'rgba(0,212,255,.15)':'var(--s1)', border:`1px solid ${activeCategory===c.cat?'var(--cy)':c.lowCount>0?'rgba(245,158,11,.35)':'var(--bd)'}`,minWidth:'90px'}}>
                    <div className="text-xl mb-1">{CAT_ICONS[c.cat]||'📦'}</div>
                    <div className="text-xs font-bold leading-tight" style={{color:activeCategory===c.cat?'var(--cy)':'var(--t1)'}}>{c.cat}</div>
                    <div className="text-xs mt-1 font-bold" style={{color:'var(--gn)'}}>{c.totalStock}</div>
                    <div style={{fontSize:'8px',color:'var(--t3)'}}>em estoque</div>
                    {c.lowCount>0&&<div className="text-xs mt-0.5 font-bold" style={{color:'var(--am)',fontSize:'9px'}}>⚠️ {c.lowCount} baixo</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search + actions */}
          <div className="flex gap-2 mb-2">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar peça..."
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
              style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
              onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
            <Btn onClick={()=>{setMove({type:'in',quantity:1,date:td()});setModalMove(true)}} size="sm" variant="secondary">± Mov</Btn>
            {can('mach')&&<Btn onClick={()=>{setEdit({unit:'un',stock:0,min_stock:1});setModal(true)}} size="sm" variant="primary">+ Nova</Btn>}
          </div>

          {/* Category filter chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
            {allCategories.map(c=>(
              <button key={c} onClick={()=>setActiveCategory(c)} className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer"
                style={{background:activeCategory===c?'var(--cy)':'transparent',color:activeCategory===c?'#000':'var(--t2)',borderColor:activeCategory===c?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
                {CAT_ICONS[c]||''} {c}
              </button>
            ))}
          </div>

          {/* Parts list */}
          {loading?<div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div>:filteredParts.length===0?<Empty icon="📦" text="Nenhuma peça"/>:(
            <div className="flex flex-col gap-2">
              {filteredParts.map(p=>{
                const low=p.stock<=p.min_stock
                return (
                  <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer"
                    style={{background:'var(--s1)',border:`1px solid ${low?'rgba(245,158,11,.4)':'var(--bd)'}`}}
                    onClick={()=>{setEdit({...p});setModal(true)}}>
                    <div className="text-xl flex-shrink-0">{CAT_ICONS[p.category||'']||'📦'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="text-xs font-semibold truncate">{p.name}</div>
                        {low&&<Badge color="amber">Estoque baixo</Badge>}
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{color:'var(--t3)'}}>{p.code}</div>
                      <div className="text-xs mt-0.5">
                        <span style={{color:low?'var(--am)':'var(--gn)',fontWeight:700}}>{p.stock} {p.unit}</span>
                        <span style={{color:'var(--t3)'}}> · Mín: {p.min_stock} · {p.category}</span>
                        {p.location&&<span style={{color:'var(--t3)'}}> · 📍{p.location}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {p.unit_value&&<div className="text-xs font-bold" style={{color:'var(--cy)'}}>R${p.unit_value}</div>}
                      <button onClick={e=>{e.stopPropagation();setMove({part_id:p.id,type:'in',quantity:1,date:td()});setModalMove(true)}}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{background:'rgba(0,212,255,.1)',color:'var(--cy)',border:'1px solid rgba(0,212,255,.2)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif'}}>
                        + Entrada
                      </button>
                      {can('mach')&&<button onClick={e=>{e.stopPropagation();del(p.id)}} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'12px'}}>🗑️</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── PURCHASE ORDERS TAB ── */}
      {tab==='orders' && (
        <>
          <SH label={`Pedidos de Compra (${orders.length})`} action={<Btn onClick={()=>{setEditPO({status:'pending',quantity:1,date_requested:td()});setModalPO(true)}} size="sm" variant="primary">+ Pedido</Btn>} />
          {orders.length===0?<Empty icon="🛒" text="Nenhum pedido"/>:(
            <div className="flex flex-col gap-2">
              {orders.map(o=>{
                const part=parts.find(p=>p.id===o.part_id)
                const sup=suppliers.find(s=>s.id===o.supplier_id)
                return (
                  <div key={o.id} onClick={()=>{setEditPO({...o});setModalPO(true)}} className="p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="text-xs font-bold">{o.part_name||part?.name}</div>
                          <Badge color={PO_COLOR[o.status] as any}>{PO_STATUS.find(s=>s.value===o.status)?.label||o.status}</Badge>
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>
                          Qtd: <strong>{o.quantity} {part?.unit||'un'}</strong>
                          {sup&&` · ${sup.razao_social||sup.name}`}
                          {o.unit_value&&` · R$${o.unit_value}/un`}
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>📅 {fmtD(o.date_requested)}{o.date_expected&&` → Previsto: ${fmtD(o.date_expected)}`}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── MOVEMENTS TAB ── */}
      {tab==='movements' && (
        <>
          <SH label={`Movimentos (${movements.length})`} action={<Btn onClick={()=>{setMove({type:'in',quantity:1,date:td()});setModalMove(true)}} size="sm" variant="primary">+ Mov.</Btn>} />
          {movements.length===0?<Empty icon="📊" text="Nenhum movimento"/>:(
            <div className="flex flex-col gap-2">
              {movements.map(m=>(
                <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:`1px solid ${m.type==='in'?'rgba(16,185,129,.25)':m.type==='out'?'rgba(239,68,68,.25)':'rgba(245,158,11,.25)'}`}}>
                  <span className="text-base flex-shrink-0">{m.type==='in'?'📥':m.type==='out'?'📤':'🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{m.part_name}</div>
                    <div className="text-xs" style={{color:'var(--t2)'}}>{m.reason||'—'} · {fmtD((m.date||m.created_at||'').split('T')[0])}</div>
                    {m.os_id&&<div className="text-xs" style={{color:'var(--cy)'}}>🔗 OS vinculada</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold" style={{color:m.type==='in'?'var(--gn)':m.type==='out'?'var(--rd)':'var(--am)'}}>
                      {m.type==='in'?'+':m.type==='out'?'-':'='}{m.quantity}
                    </div>
                    {m.stock_after!=null&&<div className="text-xs" style={{color:'var(--t3)'}}>={m.stock_after}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Part Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?`Editar: ${editing.name}`:'Nova Peça'}
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
          <Input label="Localização" value={editing.location} onChange={(v:string)=>setEdit((e:any)=>({...e,location:v}))} placeholder="Prateleira A1" />
        </div>
        <Input label="Fornecedor" value={editing.supplier} onChange={(v:string)=>setEdit((e:any)=>({...e,supplier:v}))} />
      </Modal>

      {/* Stock Movement Modal */}
      <Modal open={modalMove} onClose={()=>setModalMove(false)} title="Movimentação de Estoque"
        footer={<><Btn onClick={()=>setModalMove(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveMove} variant="primary" size="md">Confirmar</Btn></>}>
        <Select label="Peça *" value={move.part_id} onChange={(v:string)=>setMove((e:any)=>({...e,part_id:v}))}
          options={[{value:'',label:'Selecione...'},...parts.map(p=>({value:p.id,label:`${CAT_ICONS[p.category||'']||'📦'} ${p.name} — ${p.stock} ${p.unit}`}))]} />
        <div className="mb-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>Tipo de Movimento</label>
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
        {move.type==='in' && (
          <SelectComCadastro label="Fornecedor (opcional)" tipo="fornecedor" value={move.supplier_id||''} onChange={(v:string)=>setMove((e:any)=>({...e,supplier_id:v}))}
            options={suppliers.map(s=>({value:s.id,label:s.nome_razao}))}
            companyId={profile?.company_id} createdBy={profile?.display_name} onCreatedRefresh={() => load()} />
        )}
        <Select label="Vincular a OS" value={move.os_id} onChange={(v:string)=>setMove((e:any)=>({...e,os_id:v}))}
          options={[{value:'',label:'Nenhuma'},...osList.map(o=>({value:o.id,label:`${o.number} — ${o.title?.slice(0,30)}`}))]} />
        <Textarea label="Motivo / Observação" value={move.reason} onChange={(v:string)=>setMove((e:any)=>({...e,reason:v}))} rows={2} placeholder="Ex: Compra NF-001..." />

        {/* Preview stock change */}
        {move.part_id && move.quantity && (
          <div className="rounded-xl p-2.5 mt-1" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>
            {(() => {
              const p = parts.find(x=>x.id===move.part_id)
              if (!p) return null
              const after = move.type==='in' ? (p.stock||0)+Number(move.quantity) : move.type==='out' ? (p.stock||0)-Number(move.quantity) : Number(move.quantity)
              const color = after <= (p.min_stock||0) ? 'var(--am)' : 'var(--gn)'
              return (
                <div className="text-xs" style={{color:'var(--t2)'}}>
                  Estoque atual: <strong style={{color:'var(--t1)'}}>{p.stock} {p.unit}</strong>
                  <span style={{color:'var(--t3)'}}> → </span>
                  <strong style={{color}}>Após: {after} {p.unit}</strong>
                  {after <= (p.min_stock||0) && <span style={{color:'var(--am)'}}> ⚠️ Abaixo do mínimo!</span>}
                </div>
              )
            })()}
          </div>
        )}
      </Modal>

      {/* Purchase Order Modal */}
      <Modal open={modalPO} onClose={()=>setModalPO(false)} title={editPO.id?'Editar Pedido':'Novo Pedido de Compra'}
        footer={<><Btn onClick={()=>setModalPO(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={savePO} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Peça *" value={editPO.part_id} onChange={(v:string)=>setEditPO((e:any)=>({...e,part_id:v}))}
          options={[{value:'',label:'Selecione...'},...parts.map(p=>({value:p.id,label:`${p.code} — ${p.name} (${p.stock} ${p.unit})`}))]} />
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Quantidade *" value={editPO.quantity} onChange={(v:string)=>setEditPO((e:any)=>({...e,quantity:parseFloat(v)||1}))} type="number" />
          <Input label="Valor Unit. R$" value={editPO.unit_value} onChange={(v:string)=>setEditPO((e:any)=>({...e,unit_value:parseFloat(v)||undefined}))} type="number" />
          <Input label="Solicitação" value={editPO.date_requested} onChange={(v:string)=>setEditPO((e:any)=>({...e,date_requested:v}))} type="date" />
          <Input label="Previsão" value={editPO.date_expected} onChange={(v:string)=>setEditPO((e:any)=>({...e,date_expected:v}))} type="date" />
        </div>
        <SelectComCadastro label="Fornecedor" tipo="fornecedor" value={editPO.supplier_id||''} onChange={(v:string)=>setEditPO((e:any)=>({...e,supplier_id:v}))}
          options={suppliers.map(s=>({value:s.id,label:s.nome_razao}))}
          companyId={profile?.company_id} createdBy={profile?.display_name} onCreatedRefresh={() => load()} />
        <Select label="Status" value={editPO.status||'pending'} onChange={(v:string)=>setEditPO((e:any)=>({...e,status:v}))} options={PO_STATUS} />
        {editPO.status==='received' && (
          <div className="rounded-xl p-2.5 mb-2" style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.25)'}}>
            <div className="text-xs font-bold" style={{color:'var(--gn)'}}>✅ Ao salvar como Recebido, o estoque será atualizado automaticamente!</div>
          </div>
        )}
        <Textarea label="Observações" value={editPO.notes} onChange={(v:string)=>setEditPO((e:any)=>({...e,notes:v}))} rows={2} />
      </Modal>
    </div>
  )
}
