'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

export default function LoadsPage({ profile, can }: Props) {
  const [chips, setChips]       = useState<any[]>([])
  const [veneers, setVeneers]   = useState<any[]>([])
  const [clients, setClients]   = useState<any[]>([])
  const [drivers, setDrivers]   = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoad]      = useState(true)
  const [modal, setModal]       = useState(false)
  const [type, setType]         = useState<'chip'|'veneer'>('chip')
  const [editing, setEdit]      = useState<any>({})
  const [tab, setTab]           = useState('veneer')
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const [c, v, cl, d, ve] = await Promise.all([
      supabase.from('chip_loads').select('*').order('data_saida',{ascending:false}).limit(30),
      supabase.from('veneer_loads').select('*').order('data_saida',{ascending:false}).limit(30),
      supabase.from('clients').select('id,razao_social,nome_fantasia'),
      supabase.from('drivers').select('id,nome').eq('ativo',true),
      supabase.from('vehicles').select('id,placa,descricao').eq('ativo',true),
    ])
    setChips(c.data||[]); setVeneers(v.data||[])
    setClients(cl.data||[]); setDrivers(d.data||[]); setVehicles(ve.data||[])
    setLoad(false)
  }

  function calcM3(e: any) {
    const { bitola, quantidade_folhas, comprimento, largura } = e
    if (bitola && quantidade_folhas && comprimento && largura) {
      return parseFloat(((bitola * quantidade_folhas * comprimento * largura) / 1000).toFixed(3))
    }
    return undefined
  }

  async function save() {
    try {
      if (type==='chip') {
        const valor_total = (editing.peso||0)*(editing.valor_tonelada||0)/1000
        await supabase.from('chip_loads').insert({ ...editing, valor_total, created_at: new Date().toISOString() })
      } else {
        const metros_cubicos = calcM3(editing)
        const valor_total = (metros_cubicos||0)*(editing.valor_m3||0)
        await supabase.from('veneer_loads').insert({ ...editing, metros_cubicos, valor_total, created_at: new Date().toISOString() })
      }
      toast.success('Carregamento salvo ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string, tbl: string) {
    if (!await confirm('Excluir este carregamento?')) return
    await supabase.from(tbl).delete().eq('id', id)
    toast.success('Excluído'); load()
  }

  const totalVeneerM3 = veneers.reduce((s,v)=>s+(v.metros_cubicos||0),0)
  const totalVeneerVal = veneers.reduce((s,v)=>s+(v.valor_total||0),0)
  const totalChipPeso = chips.reduce((s,c)=>s+(c.peso||0),0)

  return (
    <div>
      {dialog}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <div className="rounded-xl p-2.5 text-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="text-sm font-bold" style={{color:'var(--cy)'}}>{totalVeneerM3.toFixed(2)} m³</div>
          <div style={{fontSize:'8px',color:'var(--t3)'}}>Lâminas Saídas</div>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="text-sm font-bold" style={{color:'var(--gn)'}}>R$ {totalVeneerVal.toLocaleString('pt-BR',{minimumFractionDigits:0})}</div>
          <div style={{fontSize:'8px',color:'var(--t3)'}}>Faturamento Lâminas</div>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="text-sm font-bold" style={{color:'var(--am)'}}>{(totalChipPeso/1000).toFixed(1)} t</div>
          <div style={{fontSize:'8px',color:'var(--t3)'}}>Chips Saídos</div>
        </div>
      </div>

      <div className="flex gap-1.5 mb-3">
        {[{k:'veneer',l:'🪵 Lâminas'},{k:'chip',l:'♻️ Chips/Resíduos'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
        {can('os')&&<Btn onClick={()=>{setType(tab==='veneer'?'veneer':'chip');setEdit({data_saida:td()});setModal(true)}} size="sm" variant="primary">+ Novo</Btn>}
      </div>

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : (
        <div className="flex flex-col gap-2">
          {tab==='veneer' && (veneers.length===0 ? <Empty icon="🪵" text="Nenhum carregamento de lâminas" /> : veneers.map(v=>{
            const cl = clients.find(c=>c.id===v.cliente_id)
            const dr = drivers.find(d=>d.id===v.motorista_id)
            const ve = vehicles.find(x=>x.id===v.veiculo_id)
            return (
              <div key={v.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span>🪵</span>
                      <div className="text-xs font-bold">{cl?.razao_social||'Cliente'}</div>
                    </div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>📅 {fmtD(v.data_saida)}{dr?` · ${dr.nome}`:''}{ve?` · ${ve.placa}`:''}</div>
                    <div className="flex gap-3 mt-1 flex-wrap text-xs">
                      <span style={{color:'var(--cy)',fontWeight:700}}>{v.metros_cubicos} m³</span>
                      <span style={{color:'var(--t3)'}}>Bitola {v.bitola}mm · {v.quantidade_folhas} folhas</span>
                      <span style={{color:'var(--gn)',fontWeight:700}}>R$ {Number(v.valor_total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                    </div>
                  </div>
                  {can('admin')&&<button onClick={()=>del(v.id,'veneer_loads')} style={{background:'none',border:'none',color:'var(--rd)',cursor:'pointer',fontSize:'14px'}}>🗑️</button>}
                </div>
              </div>
            )
          }))}
          {tab==='chip' && (chips.length===0 ? <Empty icon="♻️" text="Nenhum carregamento de chips" /> : chips.map(c=>{
            const cl = clients.find(x=>x.id===c.cliente_id)
            const dr = drivers.find(d=>d.id===c.motorista_id)
            return (
              <div key={c.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span>♻️</span>
                      <div className="text-xs font-bold">{cl?.razao_social||'Cliente'}</div>
                    </div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>📅 {fmtD(c.data_saida)}{dr?` · ${dr.nome}`:''}</div>
                    <div className="flex gap-3 mt-1 text-xs">
                      <span style={{color:'var(--am)',fontWeight:700}}>{c.peso} kg</span>
                      <span style={{color:'var(--gn)',fontWeight:700}}>R$ {Number(c.valor_total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                    </div>
                  </div>
                  {can('admin')&&<button onClick={()=>del(c.id,'chip_loads')} style={{background:'none',border:'none',color:'var(--rd)',cursor:'pointer',fontSize:'14px'}}>🗑️</button>}
                </div>
              </div>
            )
          }))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={type==='veneer'?'Novo Carregamento de Lâminas':'Novo Carregamento de Chips'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Select label="Cliente *" value={editing.cliente_id} onChange={(v:string)=>setEdit((e:any)=>({...e,cliente_id:v}))}
          options={[{value:'',label:'Selecione...'},...clients.map(c=>({value:c.id,label:c.razao_social||c.nome_fantasia}))]} />
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Motorista" value={editing.motorista_id} onChange={(v:string)=>setEdit((e:any)=>({...e,motorista_id:v}))}
            options={[{value:'',label:'Selecione...'},...drivers.map(d=>({value:d.id,label:d.nome}))]} />
          <Select label="Veículo" value={editing.veiculo_id} onChange={(v:string)=>setEdit((e:any)=>({...e,veiculo_id:v}))}
            options={[{value:'',label:'Selecione...'},...vehicles.map(v=>({value:v.id,label:v.placa}))]} />
          <Input label="Data Saída" value={editing.data_saida} onChange={(v:string)=>setEdit((e:any)=>({...e,data_saida:v}))} type="date" />
        </div>
        {type==='veneer' ? (
          <div className="rounded-xl p-2.5 mb-2" style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)'}}>
            <div className="text-xs font-bold mb-2" style={{color:'var(--cy)'}}>📐 Cálculo de m³ automático</div>
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Bitola (mm)" value={editing.bitola} onChange={(v:string)=>setEdit((e:any)=>({...e,bitola:parseFloat(v)||undefined}))} type="number" placeholder="0.00" />
              <Input label="Qtd Folhas" value={editing.quantidade_folhas} onChange={(v:string)=>setEdit((e:any)=>({...e,quantidade_folhas:parseInt(v)||undefined}))} type="number" />
              <Input label="Comprimento (m)" value={editing.comprimento} onChange={(v:string)=>setEdit((e:any)=>({...e,comprimento:parseFloat(v)||undefined}))} type="number" />
              <Input label="Largura (m)" value={editing.largura} onChange={(v:string)=>setEdit((e:any)=>({...e,largura:parseFloat(v)||undefined}))} type="number" />
            </div>
            {editing.bitola&&editing.quantidade_folhas&&editing.comprimento&&editing.largura&&(
              <div className="text-xs mt-1 font-bold" style={{color:'var(--am)'}}>m³ calculado: {calcM3(editing)}</div>
            )}
            <Input label="Valor R$/m³" value={editing.valor_m3} onChange={(v:string)=>setEdit((e:any)=>({...e,valor_m3:parseFloat(v)||0}))} type="number" placeholder="0.00" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-2">
            <Input label="Peso (kg)" value={editing.peso} onChange={(v:string)=>setEdit((e:any)=>({...e,peso:parseFloat(v)||0}))} type="number" />
            <Input label="Valor R$/ton" value={editing.valor_tonelada} onChange={(v:string)=>setEdit((e:any)=>({...e,valor_tonelada:parseFloat(v)||0}))} type="number" />
          </div>
        )}
      </Modal>
    </div>
  )
}
