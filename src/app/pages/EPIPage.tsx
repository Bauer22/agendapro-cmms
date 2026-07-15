'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
export default function EPIPage({ profile, can }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [tab, setTab] = useState<'stock'|'deliveries'>('stock')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); Promise.all([
    supabase.from('profiles').select('id,display_name,email'),
    supabase.from('cadastros').select('id,nome_razao').eq('is_funcionario',true).eq('status',true),
  ]).then(([p,f])=>{
    const sys = (p.data||[]).map((x:any)=>({id:x.id,display_name:x.display_name||x.email?.split('@')[0]}))
    const func = (f.data||[]).map((x:any)=>({id:x.id,display_name:x.nome_razao}))
    const seen = new Set(sys.map((s:any)=>s.display_name?.toLowerCase()))
    setUsers([...sys, ...func.filter((x:any)=>!seen.has(x.display_name?.toLowerCase()))])
  }) }, [tab])

  async function load() {
    if (tab==='stock') {
      const { data, error } = await supabase.from('epi_items').select('*').order('name')
      if (error) toast.error(error.message)
      setItems(data||[])
    } else {
      const { data, error } = await supabase.from('epi_deliveries').select('*').order('delivery_date',{ascending:false})
      if (error) toast.error(error.message)
      setDeliveries(data||[])
    }
    setLoading(false)
  }

  async function save() {
    if (tab==='stock') {
      if (!editing.name) { toast.error('Informe o nome do EPI'); return }
      const obj = { name:editing.name, category:editing.category||'EPI', ca_number:editing.ca_number, stock:parseFloat(editing.stock)||0, min_stock:parseFloat(editing.min_stock)||0, unit:editing.unit||'un', validity_months:parseInt(editing.validity_months)||0, description:editing.description }
      const { error } = editing.id ? await supabase.from('epi_items').update(obj).eq('id',editing.id) : await supabase.from('epi_items').insert(obj)
      if (error) { toast.error(error.message); return }
      toast.success('EPI salvo ✅')
    } else {
      if (!editing.epi_id||!editing.user_id) { toast.error('Selecione EPI e funcionário'); return }
      const epi = items.find(i=>i.id===editing.epi_id)
      const obj = { epi_id:editing.epi_id, epi_name:epi?.name||'', user_id:editing.user_id, user_name:users.find(u=>u.id===editing.user_id)?.display_name||'', delivery_date:editing.delivery_date||td(), quantity:parseFloat(editing.quantity)||1, validity_date:editing.validity_date||null, notes:editing.notes, delivered_by:profile?.display_name }
      const { error } = await supabase.from('epi_deliveries').insert(obj)
      if (error) { toast.error(error.message); return }
      if (epi) await supabase.from('epi_items').update({ stock: Math.max(0,(epi.stock||0)-(parseFloat(editing.quantity)||1)) }).eq('id',epi.id)
      toast.success('Entrega registrada ✅')
    }
    setModal(false); load()
  }

  async function del(id:string, tbl:string) {
    if (!await confirm('Excluir?')) return
    const { error } = await supabase.from(tbl).delete().eq('id',id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído'); load()
  }

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="🦺 EPI / Segurança" action={<Btn onClick={()=>{setEditing({});setModal(true)}} variant="primary" size="sm">+ Novo</Btn>} />
      <div className="flex gap-2 mb-3">
        {(['stock','deliveries'] as const).map(t=>(
          <div key={t} onClick={()=>{setTab(t);setLoading(true)}} style={{flex:1,textAlign:'center',padding:'8px',borderRadius:'10px',fontSize:'12px',fontWeight:700,cursor:'pointer',background:tab===t?'rgba(249,115,22,.12)':'var(--s1)',border:`1px solid ${tab===t?'rgba(249,115,22,.4)':'var(--bd)'}`,color:tab===t?'#f97316':'var(--t2)'}}>
            {t==='stock'?'📦 Estoque':'📋 Entregas'}
          </div>
        ))}
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> : tab==='stock' ? (
        items.length===0 ? <Empty icon="🦺" text="Nenhum EPI cadastrado." /> :
        <div className="flex flex-col gap-2">
          {items.map(i=>(
            <div key={i.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:`1px solid ${i.stock<=i.min_stock?'rgba(239,68,68,.4)':'var(--bd)'}`}}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color={i.stock<=i.min_stock?'red':'green'}>{i.stock<=i.min_stock?'⚠️ Estoque baixo':'✅ OK'}</Badge>
                    {i.ca_number&&<Badge color="blue">CA {i.ca_number}</Badge>}
                  </div>
                  <div className="font-bold text-sm">{i.name}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>Estoque: {i.stock} {i.unit} · Mínimo: {i.min_stock} {i.unit}</div>
                  {i.validity_months>0&&<div className="text-xs" style={{color:'var(--t3)'}}>Validade: {i.validity_months} meses</div>}
                </div>
                <div className="flex gap-1 ml-2">
                  <Btn onClick={()=>{setEditing(i);setModal(true)}} size="sm">✏️</Btn>
                  <Btn onClick={()=>del(i.id,'epi_items')} variant="danger" size="sm">🗑</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        deliveries.length===0 ? <Empty icon="📋" text="Nenhuma entrega registrada." /> :
        <div className="flex flex-col gap-2">
          {deliveries.map(d=>(
            <div key={d.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-bold text-sm">{d.epi_name}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>👤 {d.user_name} · {d.quantity} {d.unit||'un'}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>📅 {fmtD(d.delivery_date)}{d.validity_date?' · Validade: '+fmtD(d.validity_date):''}</div>
                </div>
                <Btn onClick={()=>del(d.id,'epi_deliveries')} variant="danger" size="sm">🗑</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={tab==='stock'?(editing.id?'Editar EPI':'Novo EPI'):'Registrar Entrega'}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        {tab==='stock' ? <>
          <Input label="Nome do EPI *" value={editing.name} onChange={(v:string)=>setEditing((e:any)=>({...e,name:v}))} placeholder="Ex: Capacete de segurança" />
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Nº CA" value={editing.ca_number} onChange={(v:string)=>setEditing((e:any)=>({...e,ca_number:v}))} placeholder="Ex: 12345" />
            <Input label="Unidade" value={editing.unit||'un'} onChange={(v:string)=>setEditing((e:any)=>({...e,unit:v}))} placeholder="un, par, kit..." />
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Estoque atual" value={editing.stock} onChange={(v:string)=>setEditing((e:any)=>({...e,stock:v}))} type="number" placeholder="0" />
            <Input label="Estoque mínimo" value={editing.min_stock} onChange={(v:string)=>setEditing((e:any)=>({...e,min_stock:v}))} type="number" placeholder="0" />
          </div>
          <Input label="Validade (meses)" value={editing.validity_months} onChange={(v:string)=>setEditing((e:any)=>({...e,validity_months:v}))} type="number" placeholder="Ex: 12" />
        </> : <>
          <Select label="EPI *" value={editing.epi_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,epi_id:v}))} options={[{value:'',label:'Selecione...'}, ...items.map(i=>({value:i.id,label:`${i.name} (${i.stock} disponíveis)`}))]} />
          <Select label="Funcionário *" value={editing.user_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,user_id:v}))} options={[{value:'',label:'Selecione...'}, ...users.map(u=>({value:u.id,label:u.display_name}))]} />
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Data entrega" value={editing.delivery_date||td()} onChange={(v:string)=>setEditing((e:any)=>({...e,delivery_date:v}))} type="date" />
            <Input label="Quantidade" value={editing.quantity||1} onChange={(v:string)=>setEditing((e:any)=>({...e,quantity:v}))} type="number" />
          </div>
          <Input label="Validade do item" value={editing.validity_date} onChange={(v:string)=>setEditing((e:any)=>({...e,validity_date:v}))} type="date" />
          <Input label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} placeholder="Observações da entrega..." />
        </>}
      </Modal>
    </div>
  )
}
