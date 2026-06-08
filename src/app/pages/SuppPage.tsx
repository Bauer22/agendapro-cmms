'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Textarea, SH, Empty, useConfirm } from '@/components/ui'
import toast from 'react-hot-toast'
import type { Supplier, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

export default function SuppPage({ profile, can }: Props) {
  const [supps, setSupps]   = useState<Supplier[]>([])
  const [loading, setLoad]  = useState(true)
  const [modal, setModal]   = useState(false)
  const [editing, setEdit]  = useState<Partial<Supplier>>({})
  const [search, setSearch] = useState('')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSupps(data||[]); setLoad(false)
  }

  async function save() {
    if (!editing.name) { toast.error('Informe o nome'); return }
    try {
      if (editing.id) {
        const { error } = await supabase.from('suppliers').update(editing).eq('id', editing.id)
        if (error) throw error; toast.success('Fornecedor atualizado ✅')
      } else {
        const { error } = await supabase.from('suppliers').insert({ ...editing, created_at: new Date().toISOString() })
        if (error) throw error; toast.success('Fornecedor cadastrado ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir este fornecedor?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    toast.success('Excluído'); load()
  }

  const filtered = supps.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.city||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {dialog}
      <div className="flex gap-2 mb-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar fornecedor..."
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
          onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
        {can('mach') && <Btn onClick={()=>{setEdit({});setModal(true)}} size="sm" variant="primary">+ Novo</Btn>}
      </div>
      <SH label={`Fornecedores (${filtered.length})`} />
      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : filtered.length===0 ? <Empty icon="🏭" text="Nenhum fornecedor cadastrado" /> : (
        <div className="flex flex-col gap-2">
          {filtered.map(s => (
            <div key={s.id} onClick={()=>{setEdit({...s});setModal(true)}} className="flex items-start gap-2 p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="text-xl flex-shrink-0">🏭</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{s.name}</div>
                {s.city && <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>📍 {s.city}</div>}
                <div className="flex gap-3 mt-1">
                  {s.phone && <a href={`tel:${s.phone}`} onClick={e=>e.stopPropagation()} className="text-xs" style={{color:'var(--cy)'}}>📞 {s.phone}</a>}
                  {s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/\D/g,'')}`} target="_blank" onClick={e=>e.stopPropagation()} className="text-xs" style={{color:'var(--gn)'}}>💬 WhatsApp</a>}
                </div>
              </div>
              {can('mach') && <button onClick={e=>{e.stopPropagation();del(s.id)}} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'14px',flexShrink:0}}>🗑️</button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Fornecedor':'Novo Fornecedor'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Razão Social *" value={editing.name} onChange={(v:string)=>setEdit(e=>({...e,name:v}))} placeholder="Empresa Ltda." />
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="CNPJ" value={editing.cnpj} onChange={(v:string)=>setEdit(e=>({...e,cnpj:v}))} placeholder="00.000.000/0001-00" />
          <Input label="Cidade" value={editing.city} onChange={(v:string)=>setEdit(e=>({...e,city:v}))} placeholder="São Paulo - SP" />
          <Input label="Telefone" value={editing.phone} onChange={(v:string)=>setEdit(e=>({...e,phone:v}))} placeholder="(11) 0000-0000" type="tel" />
          <Input label="WhatsApp" value={editing.whatsapp} onChange={(v:string)=>setEdit(e=>({...e,whatsapp:v}))} placeholder="(11) 00000-0000" type="tel" />
        </div>
        <Input label="E-mail" value={editing.email} onChange={(v:string)=>setEdit(e=>({...e,email:v}))} type="email" />
      </Modal>
    </div>
  )
}
