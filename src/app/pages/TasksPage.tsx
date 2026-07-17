'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, useConfirm } from '@/components/ui'
import { td, DPT, MPT } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Task, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const PRIO_C: Record<string,string> = {high:'var(--rd)',medium:'var(--am)',low:'var(--gn)'}
const PRIO_L: Record<string,string> = {high:'Alta',medium:'Média',low:'Baixa'}

export default function TasksPage({ profile, can }: Props) {
  const [tasks, setTasks]   = useState<Task[]>([])
  const [users, setUsers]   = useState<any[]>([])
  const [date, setDate]     = useState(td())
  const [modal, setModal]   = useState(false)
  const [editing, setEdit]  = useState<Partial<Task>>({})
  const [fPrio, setFPrio]   = useState('')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); loadUsers() }, [date])

  async function load() {
    const { data } = await supabase.from('tasks').select('*').eq('date', date).order('created_at',{ascending:false})
    let list = data || []
    if (fPrio) list = list.filter((t:Task) => t.priority === fPrio)
    list.sort((a:Task,b:Task) => { if(a.done!==b.done) return a.done?1:-1; const pw:any={high:0,medium:1,low:2}; return pw[a.priority]-pw[b.priority] })
    setTasks(list)
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('id,display_name,email')
    setUsers(data||[])
  }

  function openNew() { setEdit({ date, priority:'medium', done:false }); setModal(true) }
  function openEdit(t: Task) { setEdit({...t}); setModal(true) }

  async function toggle(t: Task) {
    const { error: eT } = await supabase.from('tasks').update({ done: !t.done }).eq('id', t.id)
    if (eT) { toast.error('Erro: '+eT.message); return }
    load()
  }

  async function save() {
    if (!editing.title) { toast.error('Informe o título'); return }
    const usr = users.find(u=>u.id===editing.owner_id)
    const obj = { ...editing, owner_name: usr?.display_name||usr?.email, created_by: profile?.display_name||profile?.email }
    try {
      if (editing.id) {
        const { error } = await supabase.from('tasks').update(obj).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tasks').insert({ ...obj, created_at: new Date().toISOString() })
        if (error) throw error
      }
      toast.success('Tarefa salva ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta tarefa?')) return
    const { error: eDel } = await supabase.from('tasks').delete().eq('id', id)
    if (eDel) { toast.error('Erro: '+eDel.message); return }
    toast.success('Excluída'); load()
  }

  // Calendar strip
  const now = new Date()
  const calDays = Array.from({length:21}, (_,i) => {
    const d = new Date(now); d.setDate(d.getDate() + i - 3)
    return { ds: d.toISOString().split('T')[0], d: d.getDate(), w: DPT[d.getDay()] }
  })

  return (
    <div>
      {dialog}
      {/* Calendar strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
        {calDays.map(c => (
          <button key={c.ds} onClick={()=>setDate(c.ds)} className="flex-shrink-0 w-12 py-1.5 rounded-xl text-center cursor-pointer border transition-all"
            style={{background:date===c.ds?'var(--cy)':c.ds===td()?'transparent':'transparent',borderColor:date===c.ds?'var(--cy)':c.ds===td()?'var(--cy)':'var(--bd)',color:date===c.ds?'#000':'var(--t1)'}}>
            <div style={{fontSize:'8px',textTransform:'uppercase',color:date===c.ds?'#000':'var(--t3)'}}>{c.w}</div>
            <div className="text-base font-bold">{c.d}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-2">
        <select value={fPrio} onChange={e=>{setFPrio(e.target.value);load()}} className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todas prioridades</option>
          <option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>
        </select>
        {can('tasks') && <Btn onClick={openNew} size="sm" variant="primary">+ Nova</Btn>}
      </div>

      {tasks.length === 0 ? <Empty icon="✅" text="Nenhuma tarefa neste dia" /> : (
        <div className="flex flex-col gap-2">
          {tasks.map(t => (
            <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)',opacity:t.done?.6:1}}>
              <button onClick={()=>toggle(t)} className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={{background:t.done?'var(--gn)':'transparent',border:`2px solid ${t.done?'var(--gn)':'var(--bd2)'}`,color:'#fff',cursor:'pointer'}}>
                {t.done&&'✓'}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={{textDecoration:t.done?'line-through':''}}>{t.title}</div>
                <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{color:'var(--t2)'}}>
                  <span className="font-bold" style={{color:PRIO_C[t.priority]}}>{PRIO_L[t.priority]}</span>
                  {t.time && <span>⏰ {t.time}</span>}
                  {t.owner_name && <span>👤 {t.owner_name}</span>}
                </div>
              </div>
              {can('tasks') && (
                <div className="flex gap-1">
                  <button onClick={()=>openEdit(t)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'12px'}}>✏️</button>
                  <button onClick={()=>del(t.id)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'12px'}}>🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Tarefa':'Nova Tarefa'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Título *" value={editing.title} onChange={(v:string)=>setEdit(e=>({...e,title:v}))} placeholder="O que precisa ser feito?" />
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Data" value={editing.date} onChange={(v:string)=>setEdit(e=>({...e,date:v}))} type="date" />
          <Input label="Hora" value={editing.time} onChange={(v:string)=>setEdit(e=>({...e,time:v}))} type="time" />
        </div>
        <div className="mb-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--t2)'}}>Prioridade</label>
          <div className="flex gap-1.5">
            {[['low','🟢 Baixa'],['medium','🟡 Média'],['high','🔴 Alta']].map(([v,l]) => (
              <button key={v} onClick={()=>setEdit(e=>({...e,priority:v as any}))}
                className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer border"
                style={{background:editing.priority===v?PRIO_C[v]+'22':'transparent',color:editing.priority===v?PRIO_C[v]:'var(--t2)',borderColor:editing.priority===v?PRIO_C[v]:'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <Select label="Responsável" value={editing.owner_id} onChange={(v:string)=>setEdit(e=>({...e,owner_id:v}))}
          options={[{value:'',label:'Selecione...'}, ...users.map(u=>({value:u.id,label:u.display_name||u.email}))]} />
        <Textarea label="Observações" value={editing.notes} onChange={(v:string)=>setEdit(e=>({...e,notes:v}))} rows={2} />
      </Modal>
    </div>
  )
}
