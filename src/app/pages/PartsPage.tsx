'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import toast from 'react-hot-toast'
import type { Part, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
const CATS = ['Rolamento','Correia','Corrente','Sensor','Motor','Bomba','Filtro','Válvula','Óleo','Eletrônico','Vedação','Outro']
const UNITS = [{value:'un',label:'Unidade'},{value:'kg',label:'Kg'},{value:'m',label:'Metro'},{value:'l',label:'Litro'},{value:'cj',label:'Conjunto'}]

export default function PartsPage({ profile, can }: Props) {
  const [parts, setParts]   = useState<Part[]>([])
  const [loading, setLoad]  = useState(true)
  const [modal, setModal]   = useState(false)
  const [editing, setEdit]  = useState<Partial<Part>>({})
  const [search, setSearch] = useState('')
  const [cat, setCat]       = useState('all')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('parts').select('*').order('name')
    setParts(data||[]); setLoad(false)
  }

  function openNew() { setEdit({ unit:'un', stock:0, min_stock:1 }); setModal(true) }
  function openEdit(p: Part) { setEdit({...p}); setModal(true) }

  async function save() {
    if (!editing.name||!editing.code) { toast.error('Informe nome e código'); return }
    try {
      if (editing.id) {
        const { error } = await supabase.from('parts').update(editing).eq('id', editing.id)
        if (error) throw error; toast.success('Peça atualizada ✅')
      } else {
        const { error } = await supabase.from('parts').insert({ ...editing, created_at: new Date().toISOString() })
        if (error) throw error; toast.success('Peça cadastrada ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta peça?')) return
    await supabase.from('parts').delete().eq('id', id)
    toast.success('Excluída'); load()
  }

  const filtered = parts.filter(p => {
    const q = search.toLowerCase()
    return (cat==='all'||p.category===cat) && (!q||p.name.toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q))
  })

  const lowStock = parts.filter(p => p.stock <= p.min_stock).length

  return (
    <div>
      {dialog}
      {lowStock > 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl mb-3" style={{background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.3)'}}>
          <span className="text-base">⚠️</span>
          <div className="text-xs font-semibold" style={{color:'var(--am)'}}>{lowStock} peça(s) com estoque baixo!</div>
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar peça..."
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
          onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
        {can('mach') && <Btn onClick={openNew} size="sm" variant="primary">+ Nova</Btn>}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
        {[{value:'all',label:'Todas'},...CATS.map(c=>({value:c,label:c}))].map(c => (
          <button key={c.value} onClick={()=>setCat(c.value)} className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer"
            style={{background:cat===c.value?'var(--cy)':'transparent',color:cat===c.value?'#000':'var(--t2)',borderColor:cat===c.value?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {c.label}
          </button>
        ))}
      </div>

      <SH label={`Peças (${filtered.length})`} />

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : filtered.length===0 ? <Empty icon="📦" text="Nenhuma peça cadastrada" /> : (
        <div className="flex flex-col gap-2">
          {filtered.map(p => {
            const low = p.stock <= p.min_stock
            return (
              <div key={p.id} onClick={()=>openEdit(p)} className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer"
                style={{background:'var(--s1)',border:`1px solid ${low?'rgba(245,158,11,.4)':'var(--bd)'}`}}>
                <div className="text-xl flex-shrink-0">📦</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-semibold truncate">{p.name}</div>
                    {low && <Badge color="amber">Baixo</Badge>}
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{color:'var(--t3)'}}>{p.code}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>
                    <span style={{color:low?'var(--am)':'var(--gn)',fontWeight:600}}>{p.stock} {p.unit}</span> em estoque · Mín: {p.min_stock} · {p.category}
                  </div>
                  {p.location && <div className="text-xs" style={{color:'var(--t3)'}}>📍 {p.location}</div>}
                </div>
                {p.unit_value && <div className="text-xs font-bold flex-shrink-0" style={{color:'var(--cy)'}}>R$ {p.unit_value}</div>}
                {can('mach') && <button onClick={e=>{e.stopPropagation();del(p.id)}} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'14px',flexShrink:0}}>🗑️</button>}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Peça':'Nova Peça'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Código *" value={editing.code} onChange={(v:string)=>setEdit(e=>({...e,code:v}))} placeholder="ROL-22218" />
          <Select label="Categoria" value={editing.category} onChange={(v:string)=>setEdit(e=>({...e,category:v}))} options={CATS} />
        </div>
        <Input label="Nome *" value={editing.name} onChange={(v:string)=>setEdit(e=>({...e,name:v}))} placeholder="Rolamento SKF 22218" />
        <div className="grid grid-cols-3 gap-x-2">
          <Input label="Estoque" value={editing.stock} onChange={(v:string)=>setEdit(e=>({...e,stock:parseFloat(v)||0}))} type="number" placeholder="0" />
          <Input label="Estoque Mín." value={editing.min_stock} onChange={(v:string)=>setEdit(e=>({...e,min_stock:parseFloat(v)||1}))} type="number" placeholder="1" />
          <Select label="Unidade" value={editing.unit} onChange={(v:string)=>setEdit(e=>({...e,unit:v}))} options={UNITS} />
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Valor Unitário (R$)" value={editing.unit_value} onChange={(v:string)=>setEdit(e=>({...e,unit_value:parseFloat(v)||undefined}))} type="number" placeholder="0.00" />
          <Input label="Localização" value={editing.location} onChange={(v:string)=>setEdit(e=>({...e,location:v}))} placeholder="Prateleira A1" />
        </div>
        <Input label="Fornecedor" value={editing.supplier} onChange={(v:string)=>setEdit(e=>({...e,supplier:v}))} placeholder="Nome do fornecedor" />
      </Modal>
    </div>
  )
}
