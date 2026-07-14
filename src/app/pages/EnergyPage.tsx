'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
export default function EnergyPage({ profile, can }: Props) {
  const [records, setRecords] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase.from('energy_records').select('*').order('record_date',{ascending:false}).limit(100)
    if (error) toast.error(error.message)
    setRecords(data||[]); setLoading(false)
  }

  async function save() {
    if (!editing.source||!editing.record_date) { toast.error('Preencha fonte e data'); return }
    const obj = { source:editing.source, record_date:editing.record_date, reading:parseFloat(editing.reading)||0, unit:editing.unit||'kWh', cost:parseFloat(editing.cost)||0, sector:editing.sector||'Geral', notes:editing.notes, created_by:profile?.display_name }
    const { error } = editing.id ? await supabase.from('energy_records').update(obj).eq('id',editing.id) : await supabase.from('energy_records').insert(obj)
    if (error) { toast.error(error.message); return }
    toast.success('Leitura salva ✅'); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir leitura?')) return
    const { error } = await supabase.from('energy_records').delete().eq('id',id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído'); load()
  }

  const totalCost = records.slice(0,30).reduce((s,r)=>s+(r.cost||0),0)
  const totalKwh = records.filter(r=>r.unit==='kWh').slice(0,30).reduce((s,r)=>s+(r.reading||0),0)

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="⚡ Controle de Energia" action={<Btn onClick={()=>{setEditing({record_date:td(),source:'Energia elétrica',unit:'kWh'});setModal(true)}} variant="primary" size="sm">+ Leitura</Btn>} />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <KPI num={`${totalKwh.toLocaleString('pt-BR')} kWh`} label="Consumo (30 leituras)" color="amber" />
        <KPI num={`R$ ${totalCost.toLocaleString('pt-BR',{minimumFractionDigits:0})}`} label="Custo total" color="orange" />
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> : records.length===0 ? <Empty icon="⚡" text="Nenhuma leitura registrada." /> : (
        <div className="flex flex-col gap-2">
          {records.map(r=>(
            <div key={r.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-bold text-sm">{r.source}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>📅 {fmtD(r.record_date)} · {r.sector}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--cy)'}}>⚡ {r.reading?.toLocaleString('pt-BR')} {r.unit}{r.cost>0?` · R$ ${r.cost.toLocaleString('pt-BR',{minimumFractionDigits:2})}`:''}</div>
                  {r.notes&&<div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>{r.notes}</div>}
                </div>
                <div className="flex gap-1 ml-2">
                  <Btn onClick={()=>{setEditing(r);setModal(true)}} size="sm">✏️</Btn>
                  <Btn onClick={()=>del(r.id)} variant="danger" size="sm">🗑</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Leitura':'Nova Leitura de Energia'}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Fonte *" value={editing.source||'Energia elétrica'} onChange={(v:string)=>setEditing((e:any)=>({...e,source:v}))} options={['Energia elétrica','Vapor','Gás natural','Água','Ar comprimido','Outro']} />
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data *" value={editing.record_date} onChange={(v:string)=>setEditing((e:any)=>({...e,record_date:v}))} type="date" />
          <Select label="Unidade" value={editing.unit||'kWh'} onChange={(v:string)=>setEditing((e:any)=>({...e,unit:v}))} options={['kWh','m³','ton','kg','L','Outro']} />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Leitura / Consumo" value={editing.reading} onChange={(v:string)=>setEditing((e:any)=>({...e,reading:v}))} type="number" placeholder="0" />
          <Input label="Custo R$" value={editing.cost} onChange={(v:string)=>setEditing((e:any)=>({...e,cost:v}))} type="number" placeholder="0.00" />
        </div>
        <Input label="Setor" value={editing.sector||'Geral'} onChange={(v:string)=>setEditing((e:any)=>({...e,sector:v}))} placeholder="Ex: Laminação, Secagem..." />
        <Input label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} placeholder="Ex: Leitura do medidor 3..." />
      </Modal>
    </div>
  )
}
