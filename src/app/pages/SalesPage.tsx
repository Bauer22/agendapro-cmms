'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
const STATUS_C: Record<string,string> = {quote:'blue',confirmed:'amber',production:'purple',delivered:'green',cancelled:'gray'}

export default function SalesPage({ profile, can }: Props) {
  const [orders, setOrders] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [view, setView] = useState<any>(null)
  const [editing, setEditing] = useState<any>({})
  const [items, setItems] = useState<{desc:string;qty:string;unit:string;price:string}[]>([{desc:'',qty:'',unit:'m²',price:''}])
  const [tab, setTab] = useState<'all'|'open'|'done'>('open')
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [tab])

  async function load() {
    let q = supabase.from('sales_orders').select('*').order('order_date',{ascending:false})
    if (tab==='open') q = q.in('status',['quote','confirmed','production'])
    else if (tab==='done') q = q.in('status',['delivered','cancelled'])
    const { data, error } = await q
    if (error) toast.error(error.message)
    setOrders(data||[]); setLoading(false)
  }

  async function save() {
    if (!editing.client_name||!editing.order_date) { toast.error('Informe cliente e data'); return }
    const validItems = items.filter(i=>i.desc)
    const total = validItems.reduce((s,i)=>(s+(parseFloat(i.qty)||0)*(parseFloat(i.price)||0)),0)
    const num = `PV-${Date.now().toString().slice(-5)}`
    const obj = { order_number:editing.order_number||num, client_name:editing.client_name, client_phone:editing.client_phone||'', order_date:editing.order_date, delivery_date:editing.delivery_date||null, status:editing.status||'quote', items:validItems, total_value:total, notes:editing.notes, created_by:profile?.display_name }
    const { error } = editing.id ? await supabase.from('sales_orders').update(obj).eq('id',editing.id) : await supabase.from('sales_orders').insert(obj)
    if (error) { toast.error(error.message); return }
    toast.success('Pedido salvo ✅'); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir pedido?')) return
    const { error } = await supabase.from('sales_orders').delete().eq('id',id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído'); load()
  }

  const totalOpen = orders.filter(o=>['confirmed','production'].includes(o.status)).reduce((s,o)=>s+(o.total_value||0),0)

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="🛒 Vendas e Pedidos" action={<Btn onClick={()=>{setEditing({order_date:td(),status:'quote'});setItems([{desc:'',qty:'',unit:'m²',price:''}]);setModal(true)}} variant="primary" size="sm">+ Pedido</Btn>} />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <KPI num={`R$ ${(totalOpen/1000).toFixed(0)}k`} label="Em aberto" color="amber" />
        <KPI num={orders.filter(o=>o.status==='production').length} label="Em produção" color="purple" />
      </div>

      <div className="flex gap-2 mb-3">
        {(['open','done','all'] as const).map(t=>(
          <div key={t} onClick={()=>{setTab(t);setLoading(true)}} style={{flex:1,textAlign:'center',padding:'7px',borderRadius:'10px',fontSize:'11px',fontWeight:700,cursor:'pointer',background:tab===t?'rgba(249,115,22,.12)':'var(--s1)',border:`1px solid ${tab===t?'rgba(249,115,22,.4)':'var(--bd)'}`,color:tab===t?'#f97316':'var(--t2)'}}>
            {t==='open'?'📋 Em Aberto':t==='done'?'✅ Finalizados':'📦 Todos'}
          </div>
        ))}
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> : orders.length===0 ? <Empty icon="🛒" text="Nenhum pedido." /> : (
        <div className="flex flex-col gap-2">
          {orders.map(o=>(
            <div key={o.id} onClick={()=>setView(o)} className="rounded-xl p-3 cursor-pointer" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color={STATUS_C[o.status]||'gray'}>{o.status==='quote'?'💬 Orçamento':o.status==='confirmed'?'✔ Confirmado':o.status==='production'?'🏭 Em Produção':o.status==='delivered'?'✅ Entregue':'❌ Cancelado'}</Badge>
                    <span className="text-xs" style={{color:'var(--t3)'}}>{o.order_number}</span>
                  </div>
                  <div className="font-bold text-sm">{o.client_name}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>📅 {fmtD(o.order_date)}{o.delivery_date?' · Entrega: '+fmtD(o.delivery_date):''}</div>
                  {o.total_value>0&&<div className="text-xs font-bold mt-0.5" style={{color:'var(--cy)'}}>R$ {o.total_value.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>}
                </div>
                <div className="flex gap-1 ml-2">
                  <Btn onClick={e=>{e.stopPropagation();setEditing(o);setItems(o.items||[{desc:'',qty:'',unit:'m²',price:''}]);setModal(true)}} size="sm">✏️</Btn>
                  <Btn onClick={e=>{e.stopPropagation();del(o.id)}} variant="danger" size="sm">🗑</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View */}
      <Modal open={!!view} onClose={()=>setView(null)} title={`Pedido ${view?.order_number||''}`}>
        {view&&<>
          <div className="text-sm font-bold mb-1">{view.client_name}</div>
          {view.client_phone&&<div className="text-xs mb-2" style={{color:'var(--t2)'}}>📞 {view.client_phone}</div>}
          <div className="text-xs mb-3" style={{color:'var(--t3)'}}>📅 {fmtD(view.order_date)}{view.delivery_date?' · Entrega: '+fmtD(view.delivery_date):''}</div>
          {(view.items||[]).map((it:any,i:number)=>(
            <div key={i} className="flex justify-between text-xs py-1.5 border-b" style={{borderColor:'var(--bd)'}}>
              <span>{it.desc}</span>
              <span style={{color:'var(--t2)'}}>{it.qty} {it.unit} × R$ {parseFloat(it.price||0).toFixed(2)} = <span className="font-bold" style={{color:'var(--cy)'}}>R$ {((parseFloat(it.qty)||0)*(parseFloat(it.price)||0)).toFixed(2)}</span></span>
            </div>
          ))}
          <div className="flex justify-between mt-2 font-bold text-sm">
            <span>Total</span>
            <span style={{color:'var(--cy)'}}>R$ {view.total_value?.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          </div>
          {view.notes&&<div className="mt-2 text-xs p-2 rounded-lg" style={{background:'var(--s2)',color:'var(--t2)'}}>{view.notes}</div>}
        </>}
      </Modal>

      {/* Edit */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Pedido':'Novo Pedido'}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Cliente *" value={editing.client_name} onChange={(v:string)=>setEditing((e:any)=>({...e,client_name:v}))} placeholder="Nome do cliente" />
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Telefone" value={editing.client_phone} onChange={(v:string)=>setEditing((e:any)=>({...e,client_phone:v}))} type="tel" placeholder="(00) 00000-0000" />
          <Select label="Status" value={editing.status||'quote'} onChange={(v:string)=>setEditing((e:any)=>({...e,status:v}))} options={[{value:'quote',label:'💬 Orçamento'},{value:'confirmed',label:'✔ Confirmado'},{value:'production',label:'🏭 Em Produção'},{value:'delivered',label:'✅ Entregue'},{value:'cancelled',label:'❌ Cancelado'}]} />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data do pedido *" value={editing.order_date} onChange={(v:string)=>setEditing((e:any)=>({...e,order_date:v}))} type="date" />
          <Input label="Prazo de entrega" value={editing.delivery_date} onChange={(v:string)=>setEditing((e:any)=>({...e,delivery_date:v}))} type="date" />
        </div>
        <div style={{fontSize:'10px',fontWeight:700,color:'rgba(249,115,22,.7)',textTransform:'uppercase',letterSpacing:'.5px',margin:'8px 0 6px'}}>Itens do pedido</div>
        {items.map((it,i)=>(
          <div key={i} className="grid gap-x-1 mb-2" style={{gridTemplateColumns:'1fr 60px 50px 70px 24px'}}>
            <input value={it.desc} onChange={e=>setItems(arr=>arr.map((x,j)=>j===i?{...x,desc:e.target.value}:x))} placeholder="Descrição" style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'8px',padding:'6px 8px',color:'var(--t1)',fontFamily:'Sora,system-ui',fontSize:'11px',outline:'none'}} />
            <input value={it.qty} onChange={e=>setItems(arr=>arr.map((x,j)=>j===i?{...x,qty:e.target.value}:x))} placeholder="Qtd" type="number" style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'8px',padding:'6px 4px',color:'var(--t1)',fontFamily:'Sora,system-ui',fontSize:'11px',outline:'none',textAlign:'center'}} />
            <input value={it.unit} onChange={e=>setItems(arr=>arr.map((x,j)=>j===i?{...x,unit:e.target.value}:x))} placeholder="Un" style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'8px',padding:'6px 4px',color:'var(--t1)',fontFamily:'Sora,system-ui',fontSize:'11px',outline:'none',textAlign:'center'}} />
            <input value={it.price} onChange={e=>setItems(arr=>arr.map((x,j)=>j===i?{...x,price:e.target.value}:x))} placeholder="R$/un" type="number" style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'8px',padding:'6px 4px',color:'var(--t1)',fontFamily:'Sora,system-ui',fontSize:'11px',outline:'none',textAlign:'center'}} />
            <button onClick={()=>setItems(arr=>arr.filter((_,j)=>j!==i))} style={{background:'rgba(239,68,68,.1)',border:'none',borderRadius:'6px',color:'#ef4444',cursor:'pointer',fontSize:'14px'}}>×</button>
          </div>
        ))}
        <Btn onClick={()=>setItems(arr=>[...arr,{desc:'',qty:'',unit:'m²',price:''}])} size="sm" variant="secondary">+ Item</Btn>
        <div className="text-right text-sm font-bold mt-2" style={{color:'var(--cy)'}}>
          Total: R$ {items.reduce((s,i)=>(s+(parseFloat(i.qty)||0)*(parseFloat(i.price)||0)),0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
        <Input label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} placeholder="Observações do pedido..." />
      </Modal>
    </div>
  )
}
