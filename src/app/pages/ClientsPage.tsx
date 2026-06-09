'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, SH, Empty, useConfirm } from '@/components/ui'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

export default function ClientsPage({ profile, can }: Props) {
  const [clients, setClients] = useState<any[]>([])
  const [modal, setModal]     = useState(false)
  const [editing, setEdit]    = useState<any>({})
  const [search, setSearch]   = useState('')
  const { confirm, dialog }   = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('clients').select('*').order('razao_social')
    setClients(data||[])
  }

  async function save() {
    if (!editing.razao_social) { toast.error('Informe a razão social'); return }
    if (editing.id) { await supabase.from('clients').update(editing).eq('id', editing.id) }
    else { await supabase.from('clients').insert({ ...editing, created_at: new Date().toISOString() }) }
    toast.success('Cliente salvo ✅'); setModal(false); load()
  }

  async function del(id: string) {
    if (!await confirm('Excluir este cliente?')) return
    await supabase.from('clients').delete().eq('id', id)
    toast.success('Excluído'); load()
  }

  const filtered = clients.filter(c => !search || c.razao_social?.toLowerCase().includes(search.toLowerCase()) || (c.nome_fantasia||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {dialog}
      <div className="flex gap-2 mb-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar cliente..."
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
          onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
        {can('admin')&&<Btn onClick={()=>{setEdit({});setModal(true)}} size="sm" variant="primary">+ Novo</Btn>}
      </div>
      <SH label={`Clientes (${filtered.length})`} />
      {filtered.length===0 ? <Empty icon="🏢" text="Nenhum cliente" /> : (
        <div className="flex flex-col gap-2">
          {filtered.map(c=>(
            <div key={c.id} onClick={()=>{setEdit({...c});setModal(true)}} className="flex items-start gap-2 p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="text-xl">🏢</div>
              <div className="flex-1">
                <div className="text-xs font-bold">{c.razao_social}</div>
                {c.nome_fantasia&&<div className="text-xs" style={{color:'var(--t3)'}}>{c.nome_fantasia}</div>}
                <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>
                  {c.cidade&&`📍 ${c.cidade}${c.estado?` - ${c.estado}`:''}`}
                  {c.telefone&&` · 📞 ${c.telefone}`}
                </div>
              </div>
              {can('admin')&&<button onClick={e=>{e.stopPropagation();del(c.id)}} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'14px',flexShrink:0}}>🗑️</button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Cliente':'Novo Cliente'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Razão Social *" value={editing.razao_social} onChange={(v:string)=>setEdit((e:any)=>({...e,razao_social:v}))} />
        <Input label="Nome Fantasia" value={editing.nome_fantasia} onChange={(v:string)=>setEdit((e:any)=>({...e,nome_fantasia:v}))} />
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="CNPJ" value={editing.cnpj} onChange={(v:string)=>setEdit((e:any)=>({...e,cnpj:v}))} placeholder="00.000.000/0001-00" />
          <Input label="Telefone" value={editing.telefone} onChange={(v:string)=>setEdit((e:any)=>({...e,telefone:v}))} type="tel" />
          <Input label="Cidade" value={editing.cidade} onChange={(v:string)=>setEdit((e:any)=>({...e,cidade:v}))} />
          <Input label="Estado" value={editing.estado} onChange={(v:string)=>setEdit((e:any)=>({...e,estado:v}))} placeholder="RS" />
        </div>
        <Input label="E-mail" value={editing.email} onChange={(v:string)=>setEdit((e:any)=>({...e,email:v}))} type="email" />
      </Modal>
    </div>
  )
}
