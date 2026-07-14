'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
const CATS = ['Manual','Certificado','Procedimento','Ficha técnica','Norma','Projeto','Outro']
export default function DocumentsPage({ profile, can }: Props) {
  const [docs, setDocs] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); supabase.from('machines').select('id,name,icon').then(({data})=>setMachines(data||[])) }, [])

  async function load() {
    const { data, error } = await supabase.from('documents').select('*').order('created_at',{ascending:false})
    if (error) toast.error('Erro: '+error.message)
    setDocs(data||[]); setLoading(false)
  }

  async function save() {
    if (!editing.title||!editing.category) { toast.error('Preencha título e categoria'); return }
    const obj = { title: editing.title, category: editing.category, machine_id: editing.machine_id||null, machine_name: machines.find(m=>m.id===editing.machine_id)?.name||'', description: editing.description, url: editing.url, file_name: editing.file_name, expires_at: editing.expires_at||null, created_by: profile?.display_name }
    const { error } = editing.id ? await supabase.from('documents').update(obj).eq('id',editing.id) : await supabase.from('documents').insert(obj)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Documento salvo ✅'); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir este documento?')) return
    const { error } = await supabase.from('documents').delete().eq('id',id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Excluído'); load()
  }

  const filtered = docs.filter(d => !search || d.title?.toLowerCase().includes(search.toLowerCase()) || d.category?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="📄 Documentos Técnicos" action={<Btn onClick={()=>{setEditing({category:'Manual'});setModal(true)}} variant="primary" size="sm">+ Novo</Btn>} />
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar documento..." style={{width:'100%',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'10px',padding:'8px 12px',color:'var(--t1)',fontFamily:'Sora,system-ui',fontSize:'12px',outline:'none',marginBottom:'10px'}} />

      {loading ? <Empty icon="⏳" text="Carregando..." /> : filtered.length===0 ? <Empty icon="📄" text="Nenhum documento cadastrado." /> : (
        <div className="flex flex-col gap-2">
          {filtered.map(d=>(
            <div key={d.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="blue">{d.category}</Badge>
                    {d.expires_at&&new Date(d.expires_at)<new Date()&&<Badge color="red">⚠️ Vencido</Badge>}
                  </div>
                  <div className="font-bold text-sm">{d.title}</div>
                  {d.machine_name&&<div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>⚙️ {d.machine_name}</div>}
                  {d.description&&<div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>{d.description}</div>}
                  <div className="flex items-center gap-3 mt-1">
                    {d.expires_at&&<span className="text-xs" style={{color:'var(--t3)'}}>Validade: {fmtD(d.expires_at)}</span>}
                    {d.url&&<a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-bold" style={{color:'#f97316'}}>🔗 Abrir</a>}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Btn onClick={()=>{setEditing(d);setModal(true)}} size="sm">✏️</Btn>
                  <Btn onClick={()=>del(d.id)} variant="danger" size="sm">🗑</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Documento':'Novo Documento'}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Título *" value={editing.title} onChange={(v:string)=>setEditing((e:any)=>({...e,title:v}))} placeholder="Ex: Manual do Motor WEG" />
        <Select label="Categoria *" value={editing.category||'Manual'} onChange={(v:string)=>setEditing((e:any)=>({...e,category:v}))} options={CATS} />
        <Select label="Máquina vinculada" value={editing.machine_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,machine_id:v}))} options={[{value:'',label:'Nenhuma (documento geral)'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <Textarea label="Descrição" value={editing.description} onChange={(v:string)=>setEditing((e:any)=>({...e,description:v}))} placeholder="Breve descrição do documento..." />
        <Input label="URL / Link do arquivo" value={editing.url} onChange={(v:string)=>setEditing((e:any)=>({...e,url:v}))} placeholder="https://..." type="url" />
        <Input label="Data de validade" value={editing.expires_at} onChange={(v:string)=>setEditing((e:any)=>({...e,expires_at:v}))} type="date" />
      </Modal>
    </div>
  )
}
