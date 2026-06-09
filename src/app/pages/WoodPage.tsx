'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
const CLASSES = ['Classe A','Classe B','Classe C','Resíduo','Outro']

export default function WoodPage({ profile, can }: Props) {
  const [entries, setEntries] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoad] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEdit] = useState<any>({})
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const [e, s, d, v] = await Promise.all([
      supabase.from('wood_entries').select('*').order('data_entrada',{ascending:false}).limit(50),
      supabase.from('suppliers').select('id,razao_social,nome_fantasia'),
      supabase.from('drivers').select('id,nome').eq('ativo',true),
      supabase.from('vehicles').select('id,placa,descricao').eq('ativo',true),
    ])
    setEntries(e.data||[]); setSuppliers(s.data||[]); setDrivers(d.data||[]); setVehicles(v.data||[])
    setLoad(false)
  }

  // Auto-calculate peso_estimado
  function calcPeso(e: any) {
    const { altura_media, comprimento, largura } = e
    if (altura_media && comprimento && largura) {
      return parseFloat(((altura_media * comprimento * largura) / 1.4).toFixed(2))
    }
    return undefined
  }

  async function save() {
    if (!editing.fornecedor_id) { toast.error('Selecione o fornecedor'); return }
    if (!editing.data_entrada)  { toast.error('Informe a data'); return }
    const peso_estimado = calcPeso(editing)
    const obj = { ...editing, peso_estimado, created_by: profile?.display_name||profile?.email, created_at: new Date().toISOString() }
    try {
      if (editing.id) {
        const { error } = await supabase.from('wood_entries').update(obj).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('wood_entries').insert(obj)
        if (error) throw error
      }
      toast.success('Entrada registrada ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta entrada?')) return
    await supabase.from('wood_entries').delete().eq('id', id)
    toast.success('Excluída'); load()
  }

  // Summary
  const totalVol = entries.reduce((s,e)=>s+(e.volume_estereo||0),0)
  const totalPeso = entries.reduce((s,e)=>s+(e.peso_liquido||0),0)

  return (
    <div>
      {dialog}
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <div className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="absolute top-0 inset-x-0 h-0.5" style={{background:'var(--gn)'}}/>
          <div className="text-lg font-bold" style={{color:'var(--gn)'}}>{entries.length}</div>
          <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>Entradas</div>
        </div>
        <div className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="absolute top-0 inset-x-0 h-0.5" style={{background:'var(--cy)'}}/>
          <div className="text-lg font-bold" style={{color:'var(--cy)'}}>{totalVol.toFixed(1)} m³</div>
          <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>Volume Estéreo</div>
        </div>
        <div className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="absolute top-0 inset-x-0 h-0.5" style={{background:'var(--am)'}}/>
          <div className="text-lg font-bold" style={{color:'var(--am)'}}>{(totalPeso/1000).toFixed(1)} t</div>
          <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>Peso Líquido</div>
        </div>
      </div>

      <SH label="Entradas de Madeira" action={can('os')&&<Btn onClick={()=>{setEdit({data_entrada:td(),classe:'Classe A'});setModal(true)}} size="sm" variant="primary">+ Entrada</Btn>} />

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : entries.length===0 ? <Empty icon="🪵" text="Nenhuma entrada registrada" /> : (
        <div className="flex flex-col gap-2">
          {entries.map(e => {
            const sup = suppliers.find(s=>s.id===e.fornecedor_id)
            const drv = drivers.find(d=>d.id===e.motorista_id)
            const veh = vehicles.find(v=>v.id===e.veiculo_id)
            return (
              <div key={e.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🪵</span>
                      <div className="text-xs font-bold">{sup?.razao_social||'Fornecedor'}</div>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{background:'rgba(16,185,129,.12)',color:'var(--gn)',fontSize:'9px',fontWeight:700}}>{e.classe}</span>
                    </div>
                    <div className="text-xs mt-1" style={{color:'var(--t2)'}}>📅 {fmtD(e.data_entrada)}{drv?` · 👤 ${drv.nome}`:''}{veh?` · 🚛 ${veh.placa}`:''}</div>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {e.peso_liquido&&<span className="text-xs font-bold" style={{color:'var(--am)'}}>{e.peso_liquido} kg</span>}
                      {e.volume_estereo&&<span className="text-xs font-bold" style={{color:'var(--cy)'}}>{e.volume_estereo} m³</span>}
                      {e.peso_estimado&&<span className="text-xs" style={{color:'var(--t3)'}}>≈{e.peso_estimado} kg est.</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {can('os')&&<button onClick={()=>{setEdit({...e});setModal(true)}} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>}
                    {can('admin')&&<button onClick={()=>del(e.id)} style={{background:'none',border:'none',color:'var(--rd)',cursor:'pointer',fontSize:'14px'}}>🗑️</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Entrada':'Nova Entrada de Madeira'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Fornecedor *" value={editing.fornecedor_id} onChange={(v:string)=>setEdit((e:any)=>({...e,fornecedor_id:v}))}
          options={[{value:'',label:'Selecione...'},...suppliers.map(s=>({value:s.id,label:s.razao_social||s.nome_fantasia}))]} />
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Data Entrada *" value={editing.data_entrada} onChange={(v:string)=>setEdit((e:any)=>({...e,data_entrada:v}))} type="date" />
          <Select label="Classe" value={editing.classe} onChange={(v:string)=>setEdit((e:any)=>({...e,classe:v}))} options={CLASSES} />
          <Select label="Motorista" value={editing.motorista_id} onChange={(v:string)=>setEdit((e:any)=>({...e,motorista_id:v}))}
            options={[{value:'',label:'Selecione...'},...drivers.map(d=>({value:d.id,label:d.nome}))]} />
          <Select label="Veículo" value={editing.veiculo_id} onChange={(v:string)=>setEdit((e:any)=>({...e,veiculo_id:v}))}
            options={[{value:'',label:'Selecione...'},...vehicles.map(v=>({value:v.id,label:`${v.placa} - ${v.descricao}`}))]} />
        </div>
        <div className="rounded-xl p-2.5 mb-2" style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)'}}>
          <div className="text-xs font-bold mb-2" style={{color:'var(--cy)'}}>📐 Dimensões (calcula peso estimado automaticamente)</div>
          <div className="grid grid-cols-3 gap-x-2">
            <Input label="Altura Média (m)" value={editing.altura_media} onChange={(v:string)=>setEdit((e:any)=>({...e,altura_media:parseFloat(v)||undefined}))} type="number" placeholder="0.00" />
            <Input label="Comprimento (m)" value={editing.comprimento} onChange={(v:string)=>setEdit((e:any)=>({...e,comprimento:parseFloat(v)||undefined}))} type="number" placeholder="0.00" />
            <Input label="Largura (m)" value={editing.largura} onChange={(v:string)=>setEdit((e:any)=>({...e,largura:parseFloat(v)||undefined}))} type="number" placeholder="0.00" />
          </div>
          {editing.altura_media&&editing.comprimento&&editing.largura&&(
            <div className="text-xs mt-1" style={{color:'var(--am)',fontWeight:600}}>
              Peso estimado: {calcPeso(editing)} kg
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Peso Líquido (kg)" value={editing.peso_liquido} onChange={(v:string)=>setEdit((e:any)=>({...e,peso_liquido:parseFloat(v)||undefined}))} type="number" />
          <Input label="Volume Estéreo (m³)" value={editing.volume_estereo} onChange={(v:string)=>setEdit((e:any)=>({...e,volume_estereo:parseFloat(v)||undefined}))} type="number" />
        </div>
        <Textarea label="Observação" value={editing.observacao} onChange={(v:string)=>setEdit((e:any)=>({...e,observacao:v}))} rows={2} />
      </Modal>
    </div>
  )
}
