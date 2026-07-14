'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, Badge, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
export default function WoodPage({ profile, can }: Props) {
  const [entries, setEntries] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); supabase.from('suppliers').select('id,name').then(({data})=>setSuppliers(data||[])) }, [])

  async function load() {
    const { data, error } = await supabase.from('wood_entries').select('*').order('entry_date',{ascending:false}).limit(100)
    if (error) toast.error(error.message)
    setEntries(data||[]); setLoading(false)
  }

  async function save() {
    if (!editing.species||!editing.entry_date) { toast.error('Informe espécie e data'); return }
    const obj = { species:editing.species, origin:editing.origin||'', supplier_id:editing.supplier_id||null, supplier_name:suppliers.find(s=>s.id===editing.supplier_id)?.name||editing.origin||'', entry_date:editing.entry_date, truck_plate:editing.truck_plate||'', volume_m3:parseFloat(editing.volume_m3)||0, log_count:parseInt(editing.log_count)||0, avg_length:parseFloat(editing.avg_length)||0, avg_diameter:parseFloat(editing.avg_diameter)||0, unit_value:parseFloat(editing.unit_value)||0, total_value:parseFloat(editing.volume_m3||0)*parseFloat(editing.unit_value||0), romaneio:editing.romaneio||'', quality:editing.quality||'Normal', notes:editing.notes, created_by:profile?.display_name }
    const { error } = editing.id ? await supabase.from('wood_entries').update(obj).eq('id',editing.id) : await supabase.from('wood_entries').insert(obj)
    if (error) { toast.error(error.message); return }
    toast.success('Entrada registrada ✅'); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir esta entrada?')) return
    const { error } = await supabase.from('wood_entries').delete().eq('id',id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído'); load()
  }

  const totalM3 = entries.slice(0,30).reduce((s,e)=>s+(e.volume_m3||0),0)
  const totalVal = entries.slice(0,30).reduce((s,e)=>s+(e.total_value||0),0)

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="🪵 Entrada de Madeira" action={<Btn onClick={()=>{setEditing({entry_date:td(),quality:'Normal'});setModal(true)}} variant="primary" size="sm">+ Entrada</Btn>} />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <KPI num={`${totalM3.toFixed(1)} m³`} label="Volume (30 últ.)" color="green" />
        <KPI num={`R$ ${(totalVal/1000).toFixed(0)}k`} label="Valor total" color="orange" />
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> : entries.length===0 ? <Empty icon="🪵" text="Nenhuma entrada registrada." /> : (
        <div className="flex flex-col gap-2">
          {entries.map(e=>(
            <div key={e.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="green">{e.species}</Badge>
                    {e.quality&&e.quality!=='Normal'&&<Badge color="amber">{e.quality}</Badge>}
                  </div>
                  <div className="font-bold text-sm">{e.volume_m3?.toFixed(2)} m³ · {e.log_count} toras</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>🏭 {e.supplier_name||e.origin||'—'} · {fmtD(e.entry_date)}</div>
                  {e.truck_plate&&<div className="text-xs" style={{color:'var(--t3)'}}>🚛 {e.truck_plate}{e.romaneio?' · Romaneio: '+e.romaneio:''}</div>}
                  {e.total_value>0&&<div className="text-xs font-bold mt-0.5" style={{color:'var(--cy)'}}>R$ {e.total_value.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>}
                </div>
                <div className="flex gap-1 ml-2">
                  <Btn onClick={()=>{setEditing(e);setModal(true)}} size="sm">✏️</Btn>
                  <Btn onClick={()=>del(e.id)} variant="danger" size="sm">🗑</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Entrada':'Nova Entrada de Madeira'}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Espécie *" value={editing.species} onChange={(v:string)=>setEditing((e:any)=>({...e,species:v}))} placeholder="Ex: Pinus, Eucalipto" />
          <Input label="Data *" value={editing.entry_date} onChange={(v:string)=>setEditing((e:any)=>({...e,entry_date:v}))} type="date" />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Select label="Fornecedor" value={editing.supplier_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,supplier_id:v}))} options={[{value:'',label:'Outro/Manual'}, ...suppliers.map(s=>({value:s.id,label:s.name}))]} />
          <Input label="Origem (fazenda)" value={editing.origin} onChange={(v:string)=>setEditing((e:any)=>({...e,origin:v}))} placeholder="Ex: Fazenda Silva" />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Volume (m³)" value={editing.volume_m3} onChange={(v:string)=>setEditing((e:any)=>({...e,volume_m3:v}))} type="number" placeholder="0.00" />
          <Input label="Nº de toras" value={editing.log_count} onChange={(v:string)=>setEditing((e:any)=>({...e,log_count:v}))} type="number" placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Compr. médio (m)" value={editing.avg_length} onChange={(v:string)=>setEditing((e:any)=>({...e,avg_length:v}))} type="number" placeholder="0.0" />
          <Input label="Diâm. médio (cm)" value={editing.avg_diameter} onChange={(v:string)=>setEditing((e:any)=>({...e,avg_diameter:v}))} type="number" placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Valor/m³ R$" value={editing.unit_value} onChange={(v:string)=>setEditing((e:any)=>({...e,unit_value:v}))} type="number" placeholder="0.00" />
          <Input label="Placa do caminhão" value={editing.truck_plate} onChange={(v:string)=>setEditing((e:any)=>({...e,truck_plate:v.toUpperCase()}))} placeholder="ABC-0000" />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Nº Romaneio" value={editing.romaneio} onChange={(v:string)=>setEditing((e:any)=>({...e,romaneio:v}))} placeholder="Ex: R-001" />
          <Select label="Qualidade" value={editing.quality||'Normal'} onChange={(v:string)=>setEditing((e:any)=>({...e,quality:v}))} options={['Normal','Selecionada','Industrial','Refugo']} />
        </div>
        <Input label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} placeholder="Observações da carga..." />
      </Modal>
    </div>
  )
}
