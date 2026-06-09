'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, useConfirm } from '@/components/ui'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
const VEHICLE_TYPES = ['Caminhão','Carreta','Toco','VW','Utilitário','Trator','Empilhadeira','Outro']

export default function DriversPage({ profile, can }: Props) {
  const [drivers, setDrivers]   = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [modal, setModal]       = useState(false)
  const [modalV, setModalV]     = useState(false)
  const [editing, setEdit]      = useState<any>({})
  const [editingV, setEditV]    = useState<any>({})
  const [tab, setTab]           = useState('drivers')
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const [d, v] = await Promise.all([
      supabase.from('drivers').select('*').order('nome'),
      supabase.from('vehicles').select('*').order('placa'),
    ])
    setDrivers(d.data||[]); setVehicles(v.data||[])
  }

  async function saveDriver() {
    if (!editing.nome) { toast.error('Informe o nome'); return }
    const obj = { ...editing, ativo: true }
    if (editing.id) { await supabase.from('drivers').update(obj).eq('id', editing.id) }
    else { await supabase.from('drivers').insert({ ...obj, created_at: new Date().toISOString() }) }
    toast.success('Salvo ✅'); setModal(false); load()
  }

  async function saveVehicle() {
    if (!editing.placa) { toast.error('Informe a placa'); return }
    const obj = { ...editingV, ativo: true }
    if (editingV.id) { await supabase.from('vehicles').update(obj).eq('id', editingV.id) }
    else { await supabase.from('vehicles').insert({ ...obj, created_at: new Date().toISOString() }) }
    toast.success('Salvo ✅'); setModalV(false); load()
  }

  async function toggleDriver(id: string, ativo: boolean) {
    await supabase.from('drivers').update({ ativo: !ativo }).eq('id', id)
    load()
  }

  return (
    <div>
      {dialog}
      <div className="flex gap-1.5 mb-3">
        {[{k:'drivers',l:'👤 Motoristas'},{k:'vehicles',l:'🚛 Veículos'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='drivers' && (
        <>
          <SH label={`Motoristas (${drivers.length})`} action={can('admin')&&<Btn onClick={()=>{setEdit({});setModal(true)}} size="sm" variant="primary">+ Novo</Btn>} />
          {drivers.length===0 ? <Empty icon="👤" text="Nenhum motorista" /> : (
            <div className="flex flex-col gap-2">
              {drivers.map(d=>(
                <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)',opacity:d.ativo?1:.5}}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{background:'rgba(0,212,255,.15)',color:'var(--cy)'}}>{d.nome[0]}</div>
                  <div className="flex-1">
                    <div className="text-xs font-bold">{d.nome}</div>
                    <div className="text-xs" style={{color:'var(--t2)'}}>{d.cpf&&`CPF: ${d.cpf}`}{d.telefone&&` · ${d.telefone}`}</div>
                  </div>
                  <button onClick={()=>{setEdit({...d});setModal(true)}} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>
                  <button onClick={()=>toggleDriver(d.id,d.ativo)} style={{background:'none',border:'none',color:d.ativo?'var(--gn)':'var(--t3)',cursor:'pointer',fontSize:'14px'}}>{d.ativo?'✅':'❌'}</button>
                </div>
              ))}
            </div>
          )}
          <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Motorista':'Novo Motorista'}
            footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveDriver} variant="primary" size="md">Salvar</Btn></>}>
            <Input label="Nome *" value={editing.nome} onChange={(v:string)=>setEdit((e:any)=>({...e,nome:v}))} />
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="CPF" value={editing.cpf} onChange={(v:string)=>setEdit((e:any)=>({...e,cpf:v}))} placeholder="000.000.000-00" />
              <Input label="Telefone" value={editing.telefone} onChange={(v:string)=>setEdit((e:any)=>({...e,telefone:v}))} type="tel" />
            </div>
          </Modal>
        </>
      )}

      {tab==='vehicles' && (
        <>
          <SH label={`Veículos (${vehicles.length})`} action={can('admin')&&<Btn onClick={()=>{setEditV({});setModalV(true)}} size="sm" variant="primary">+ Novo</Btn>} />
          {vehicles.length===0 ? <Empty icon="🚛" text="Nenhum veículo" /> : (
            <div className="flex flex-col gap-2">
              {vehicles.map(v=>{
                const driver = drivers.find(d=>d.id===v.motorista_id)
                return (
                  <div key={v.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)',opacity:v.ativo?1:.5}}>
                    <div className="text-xl">🚛</div>
                    <div className="flex-1">
                      <div className="text-xs font-bold">{v.placa} — {v.descricao}</div>
                      <div className="text-xs" style={{color:'var(--t2)'}}>{v.tipo}{driver?` · ${driver.nome}`:''}</div>
                    </div>
                    <button onClick={()=>{setEditV({...v});setModalV(true)}} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>
                  </div>
                )
              })}
            </div>
          )}
          <Modal open={modalV} onClose={()=>setModalV(false)} title={editingV.id?'Editar Veículo':'Novo Veículo'}
            footer={<><Btn onClick={()=>setModalV(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveVehicle} variant="primary" size="md">Salvar</Btn></>}>
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Placa *" value={editingV.placa} onChange={(v:string)=>setEditV((e:any)=>({...e,placa:v}))} placeholder="ABC-1234" />
              <Select label="Tipo" value={editingV.tipo} onChange={(v:string)=>setEditV((e:any)=>({...e,tipo:v}))} options={VEHICLE_TYPES} />
            </div>
            <Input label="Descrição" value={editingV.descricao} onChange={(v:string)=>setEditV((e:any)=>({...e,descricao:v}))} placeholder="VW Constellation" />
            <Select label="Motorista Padrão" value={editingV.motorista_id} onChange={(v:string)=>setEditV((e:any)=>({...e,motorista_id:v}))}
              options={[{value:'',label:'Nenhum'},...drivers.map(d=>({value:d.id,label:d.nome}))]} />
          </Modal>
        </>
      )}
    </div>
  )
}
