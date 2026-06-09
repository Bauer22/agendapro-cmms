'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

export default function FuelPage({ profile, can }: Props) {
  const [entries, setEntries]   = useState<any[]>([])
  const [outputs, setOutputs]   = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [drivers, setDrivers]   = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [stock, setStock]       = useState(0)
  const [loading, setLoad]      = useState(true)
  const [modal, setModal]       = useState(false)
  const [modalType, setModalType] = useState<'entry'|'output'>('entry')
  const [editing, setEdit]      = useState<any>({})
  const [tab, setTab]           = useState('stock')
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const [e, o, s, d, v] = await Promise.all([
      supabase.from('fuel_entries').select('*').order('created_at',{ascending:false}).limit(30),
      supabase.from('fuel_outputs').select('*').order('data_abastecimento',{ascending:false}).limit(30),
      supabase.from('suppliers').select('id,razao_social,nome_fantasia'),
      supabase.from('drivers').select('id,nome').eq('ativo',true),
      supabase.from('vehicles').select('id,placa,descricao').eq('ativo',true),
    ])
    const totalIn  = (e.data||[]).reduce((s:number,x:any)=>s+(x.litros||0),0)
    const totalOut = (o.data||[]).reduce((s:number,x:any)=>s+(x.litros||0),0)
    setEntries(e.data||[]); setOutputs(o.data||[])
    setSuppliers(s.data||[]); setDrivers(d.data||[]); setVehicles(v.data||[])
    setStock(totalIn - totalOut)
    setLoad(false)
  }

  function openEntry() { setEdit({valor_litro:0,litros:0}); setModalType('entry'); setModal(true) }
  function openOutput() { setEdit({data_abastecimento:td(),litros:0}); setModalType('output'); setModal(true) }

  async function save() {
    try {
      if (modalType==='entry') {
        if (!editing.litros||!editing.fornecedor_id) { toast.error('Preencha fornecedor e litros'); return }
        const valor_total = (editing.litros||0)*(editing.valor_litro||0)
        await supabase.from('fuel_entries').insert({ ...editing, valor_total, created_at: new Date().toISOString() })
      } else {
        if (!editing.litros) { toast.error('Informe os litros'); return }
        await supabase.from('fuel_outputs').insert({ ...editing, created_at: new Date().toISOString() })
      }
      toast.success('Salvo ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  const stockColor = stock > 500 ? 'var(--gn)' : stock > 100 ? 'var(--am)' : 'var(--rd)'

  return (
    <div>
      {dialog}
      {/* Stock card */}
      <div className="rounded-xl p-4 mb-3 text-center relative overflow-hidden" style={{background:'var(--s1)',border:`2px solid ${stockColor}`}}>
        <div className="absolute top-0 inset-x-0 h-1" style={{background:stockColor}}/>
        <div className="text-4xl mb-1">⛽</div>
        <div className="font-bebas text-5xl" style={{color:stockColor}}>{stock.toFixed(0)} L</div>
        <div className="text-xs mt-1" style={{color:'var(--t2)'}}>ESTOQUE ATUAL DE COMBUSTÍVEL</div>
        <div className="flex gap-2 justify-center mt-3">
          <Btn onClick={openEntry} size="sm" variant="primary">+ Entrada</Btn>
          <Btn onClick={openOutput} size="sm" variant="secondary">- Abastecimento</Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <div className="rounded-xl p-2.5 text-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="text-sm font-bold" style={{color:'var(--gn)'}}>{entries.reduce((s,e)=>s+(e.litros||0),0).toFixed(0)} L</div>
          <div style={{fontSize:'9px',color:'var(--t3)'}}>Total Entradas</div>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="text-sm font-bold" style={{color:'var(--rd)'}}>{outputs.reduce((s,o)=>s+(o.litros||0),0).toFixed(0)} L</div>
          <div style={{fontSize:'9px',color:'var(--t3)'}}>Total Saídas</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3">
        {[{k:'stock',l:'Movimentações'},{k:'entries',l:'Entradas'},{k:'outputs',l:'Abastecimentos'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : (
        <div className="flex flex-col gap-2">
          {(tab==='stock'||tab==='entries') && entries.map(e=>{
            const sup = suppliers.find(s=>s.id===e.fornecedor_id)
            return (
              <div key={e.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid rgba(16,185,129,.3)'}}>
                <span className="text-base">⬆️</span>
                <div className="flex-1">
                  <div className="text-xs font-bold">{sup?.razao_social||'Fornecedor'}</div>
                  <div className="text-xs" style={{color:'var(--t2)'}}>{fmtD(e.created_at?.split('T')[0])} · R$ {Number(e.valor_litro||0).toFixed(3)}/L</div>
                </div>
                <div className="text-sm font-bold" style={{color:'var(--gn)'}}>+{e.litros} L</div>
              </div>
            )
          })}
          {(tab==='stock'||tab==='outputs') && outputs.map(o=>{
            const drv = drivers.find(d=>d.id===o.motorista_id)
            const veh = vehicles.find(v=>v.id===o.veiculo_id)
            return (
              <div key={o.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid rgba(239,68,68,.25)'}}>
                <span className="text-base">⬇️</span>
                <div className="flex-1">
                  <div className="text-xs font-bold">{drv?.nome||'Operador'}{veh?` · ${veh.placa}`:''}</div>
                  <div className="text-xs" style={{color:'var(--t2)'}}>{fmtD(o.data_abastecimento)}{o.observacao?` · ${o.observacao}`:''}</div>
                </div>
                <div className="text-sm font-bold" style={{color:'var(--rd)'}}>-{o.litros} L</div>
              </div>
            )
          })}
          {tab!=='stock' && entries.length===0 && outputs.length===0 && <Empty icon="⛽" text="Nenhuma movimentação" />}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={modalType==='entry'?'Entrada de Combustível':'Abastecimento'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        {modalType==='entry' ? (
          <>
            <Select label="Fornecedor *" value={editing.fornecedor_id} onChange={(v:string)=>setEdit((e:any)=>({...e,fornecedor_id:v}))}
              options={[{value:'',label:'Selecione...'},...suppliers.map(s=>({value:s.id,label:s.razao_social||s.nome_fantasia}))]} />
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Litros *" value={editing.litros} onChange={(v:string)=>setEdit((e:any)=>({...e,litros:parseFloat(v)||0}))} type="number" />
              <Input label="Valor/Litro R$" value={editing.valor_litro} onChange={(v:string)=>setEdit((e:any)=>({...e,valor_litro:parseFloat(v)||0}))} type="number" placeholder="0.000" />
            </div>
            <Input label="Vencimento NF" value={editing.vencimento} onChange={(v:string)=>setEdit((e:any)=>({...e,vencimento:v}))} type="date" />
          </>
        ) : (
          <>
            <Select label="Motorista/Operador" value={editing.motorista_id} onChange={(v:string)=>setEdit((e:any)=>({...e,motorista_id:v}))}
              options={[{value:'',label:'Selecione...'},...drivers.map(d=>({value:d.id,label:d.nome}))]} />
            <Select label="Veículo/Equipamento" value={editing.veiculo_id} onChange={(v:string)=>setEdit((e:any)=>({...e,veiculo_id:v}))}
              options={[{value:'',label:'Selecione...'},...vehicles.map(v=>({value:v.id,label:`${v.placa} - ${v.descricao}`}))]} />
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Litros *" value={editing.litros} onChange={(v:string)=>setEdit((e:any)=>({...e,litros:parseFloat(v)||0}))} type="number" />
              <Input label="Data" value={editing.data_abastecimento} onChange={(v:string)=>setEdit((e:any)=>({...e,data_abastecimento:v}))} type="date" />
            </div>
            <Textarea label="Observação" value={editing.observacao} onChange={(v:string)=>setEdit((e:any)=>({...e,observacao:v}))} rows={2} />
          </>
        )}
      </Modal>
    </div>
  )
}
