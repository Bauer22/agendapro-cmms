'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtH, fmtD, td, oilStatus, PERIOD_LABEL } from '@/lib/utils'
import { DEFAULT_MACHINES } from '@/lib/machines-seed'
import toast from 'react-hot-toast'
import type { Machine, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const CATEGORIES = [{value:'production',label:'Produção'},{value:'transport',label:'Transporte'},{value:'utility',label:'Utilidades'},{value:'other',label:'Outro'}]
const SECTORS = ['Laminação','Secagem','Montagem','Utilidades','Pátio','Manutenção','Outro']
const TABS = [{k:'info',l:'Dados'},{k:'comp',l:'Componentes'},{k:'pm',l:'Plano MP'},{k:'hours',l:'Horas'}]

export default function MachPage({ profile, can }: Props) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [tab, setTab]           = useState('info')
  const [editing, setEditing]   = useState<Partial<Machine>>({})
  const [search, setSearch]     = useState('')
  const [cat, setCat]           = useState('all')
  const [newComp, setNewComp]   = useState('')
  const [newTask, setNewTask]   = useState('')
  const [newPeriod, setNewPeriod] = useState('monthly')
  const [seeded, setSeeded]     = useState(false)
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('machines').select('*').order('name')
    const list = data || []
    setMachines(list)
    setLoading(false)
    // Auto-seed if empty
    if (list.length === 0 && !seeded) {
      setSeeded(true)
      await seedMachines()
    }
  }

  async function seedMachines() {
    const recs = DEFAULT_MACHINES.map(m => ({ ...m, created_at: new Date().toISOString() }))
    await supabase.from('machines').insert(recs)
    const { data } = await supabase.from('machines').select('*').order('name')
    setMachines(data || [])
    toast.success('7 máquinas padrão instaladas ✅')
  }

  function openNew() {
    setEditing({ category:'production', icon:'⚙️', components:[], pm_plan:[] })
    setTab('info'); setModal(true)
  }
  async function openEdit(m: Machine) {
    setEditing({ ...m, components: m.components||[], pm_plan: m.pm_plan||[] })
    setTab('info'); setModal(true)
  }

  async function save() {
    if (!editing.name) { toast.error('Informe o nome da máquina'); return }
    try {
      if (editing.id) {
        const { error } = await supabase.from('machines').update(editing).eq('id', editing.id)
        if (error) throw error
        toast.success('Máquina atualizada ✅')
      } else {
        const { error } = await supabase.from('machines').insert({ ...editing, created_at: new Date().toISOString() })
        if (error) throw error
        toast.success('Máquina cadastrada ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: ' + e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta máquina?')) return
    await supabase.from('machines').delete().eq('id', id)
    toast.success('Excluída'); load()
  }

  function addComp() {
    if (!newComp.trim()) return
    setEditing(e => ({ ...e, components: [...(e.components||[]), newComp.trim()] }))
    setNewComp('')
  }
  function rmComp(i: number) { setEditing(e => ({ ...e, components: (e.components||[]).filter((_:any,j:number)=>j!==i) })) }

  function addPM() {
    if (!newTask.trim()) return
    setEditing(e => ({ ...e, pm_plan: [...(e.pm_plan||[]), { task: newTask.trim(), period: newPeriod }] }))
    setNewTask('')
  }
  function rmPM(i: number) { setEditing(e => ({ ...e, pm_plan: (e.pm_plan||[]).filter((_:any,j:number)=>j!==i) })) }

  const filtered = machines.filter(m => {
    const q = search.toLowerCase()
    return (cat==='all'||m.category===cat) && (!q||m.name.toLowerCase().includes(q)||(m.code||'').toLowerCase().includes(q))
  })

  return (
    <div>
      {dialog}
      <div className="flex gap-2 mb-2">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar máquina..."
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
          onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
        {can('mach') && <Btn onClick={openNew} size="sm" variant="primary">+ Nova</Btn>}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
        {[{value:'all',label:'Todas'},...CATEGORIES].map(c => (
          <button key={c.value} onClick={()=>setCat(c.value)} className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer"
            style={{background:cat===c.value?'var(--cy)':'transparent',color:cat===c.value?'#000':'var(--t2)',borderColor:cat===c.value?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : (
        filtered.length === 0 ? <Empty icon="⚙️" text="Nenhuma máquina encontrada" /> : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(m => {
              let statusClass = 'rgba(16,185,129,.3)'
              let oilInfo = null
              if (m.category === 'transport' && m.oil_interval) {
                const oi = oilStatus(m.current_hours||0, m.last_oil_hours||0, m.oil_interval)
                statusClass = oi.color === 'rd' ? 'rgba(239,68,68,.5)' : oi.color === 'am' ? 'rgba(245,158,11,.45)' : 'rgba(16,185,129,.28)'
                oilInfo = oi
              }
              return (
                <div key={m.id} onClick={()=>openEdit(m)} className="rounded-xl p-3 cursor-pointer transition-all relative overflow-hidden"
                  style={{background:'var(--s1)',border:`1px solid ${statusClass}`}}>
                  <div className="absolute top-2 right-2 flex gap-1">
                    {can('mach') && <button onClick={e=>{e.stopPropagation();del(m.id)}} className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{background:'var(--s2)',border:'none',color:'var(--t3)',cursor:'pointer'}}>🗑️</button>}
                  </div>
                  <div className="text-2xl mb-1">{m.icon||'⚙️'}</div>
                  <div className="text-xs font-bold leading-tight">{m.name}</div>
                  <div className="text-xs font-mono mt-0.5" style={{color:'var(--t3)'}}>{m.code||'—'}</div>
                  <div className="text-xs mt-1" style={{color:'var(--t3)'}}>{m.location||m.sector}</div>
                  {oilInfo && (
                    <>
                      <div className="h-1 rounded-full mt-2 overflow-hidden" style={{background:'var(--s2)'}}>
                        <div className="h-full rounded-full" style={{width:`${oilInfo.pct}%`,background:oilInfo.color==='rd'?'var(--rd)':oilInfo.color==='am'?'var(--am)':'var(--gn)'}}/>
                      </div>
                      <div className="text-xs mt-1" style={{color:'var(--t3)',fontSize:'9px'}}>{fmtH(m.current_hours)} · {oilInfo.label}</div>
                    </>
                  )}
                  {(m.pm_plan||[]).length > 0 && <div className="text-xs mt-1" style={{color:'var(--t3)',fontSize:'9px'}}>📋 {(m.pm_plan||[]).length} tarefas MP</div>}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Máquina':'Cadastrar Máquina'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
          {TABS.filter(t => t.k!=='hours'||!!editing.id).map(t => (
            <button key={t.k} onClick={()=>setTab(t.k)} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border"
              style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
              {t.l}
            </button>
          ))}
        </div>

        {tab==='info' && (
          <div>
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Nome *" value={editing.name} onChange={(v:string)=>setEditing(e=>({...e,name:v}))} placeholder="Torno CNC" className="col-span-2" />
              <Input label="Código/TAG" value={editing.code} onChange={(v:string)=>setEditing(e=>({...e,code:v}))} placeholder="TOR-001" />
              <Input label="Ícone" value={editing.icon} onChange={(v:string)=>setEditing(e=>({...e,icon:v}))} placeholder="⚙️" />
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <Select label="Categoria" value={editing.category} onChange={(v:string)=>setEditing(e=>({...e,category:v}))} options={CATEGORIES} />
              <Select label="Setor" value={editing.sector} onChange={(v:string)=>setEditing(e=>({...e,sector:v}))} options={SECTORS} />
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Fabricante" value={editing.brand} onChange={(v:string)=>setEditing(e=>({...e,brand:v}))} />
              <Input label="Modelo" value={editing.model} onChange={(v:string)=>setEditing(e=>({...e,model:v}))} />
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Nº Série" value={editing.serial} onChange={(v:string)=>setEditing(e=>({...e,serial:v}))} />
              <Input label="Ano" value={editing.year} onChange={(v:string)=>setEditing(e=>({...e,year:parseInt(v)||undefined}))} type="number" placeholder="2020" />
            </div>
            <Input label="Localização" value={editing.location} onChange={(v:string)=>setEditing(e=>({...e,location:v}))} placeholder="Galpão A - Linha 1" />
            <Textarea label="Observações" value={editing.notes} onChange={(v:string)=>setEditing(e=>({...e,notes:v}))} rows={2} />
            {(editing.category==='transport') && (
              <div className="rounded-xl p-3 mt-1" style={{background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.25)'}}>
                <div className="text-xs font-bold mb-2" style={{color:'var(--am)'}}>🛢️ Controle de Horas / Óleo</div>
                <div className="grid grid-cols-2 gap-x-2">
                  <Input label="Horas Atuais (h)" value={editing.current_hours} onChange={(v:string)=>setEditing(e=>({...e,current_hours:parseFloat(v)||0}))} type="number" placeholder="0" />
                  <Input label="Intervalo Troca (h)" value={editing.oil_interval} onChange={(v:string)=>setEditing(e=>({...e,oil_interval:parseFloat(v)||250}))} type="number" placeholder="250" />
                  <Input label="Horas Últ. Troca" value={editing.last_oil_hours} onChange={(v:string)=>setEditing(e=>({...e,last_oil_hours:parseFloat(v)||0}))} type="number" placeholder="0" />
                  <Input label="Data Últ. Troca" value={editing.last_oil_date} onChange={(v:string)=>setEditing(e=>({...e,last_oil_date:v}))} type="date" />
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='comp' && (
          <div>
            <div className="text-xs mb-2" style={{color:'var(--t2)'}}>Subgrupos e componentes desta máquina</div>
            {(editing.components||[]).map((c:string,i:number) => (
              <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-1.5 text-xs" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>
                <span>{c}</span>
                <button onClick={()=>rmComp(i)} className="text-base leading-none" style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer'}}>×</button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input value={newComp} onChange={e=>setNewComp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addComp()} placeholder="Nome do componente"
                className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
                onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
              <Btn onClick={addComp} size="sm" variant="primary">+ Add</Btn>
            </div>
          </div>
        )}

        {tab==='pm' && (
          <div>
            <div className="text-xs mb-2" style={{color:'var(--t2)'}}>Tarefas preventivas por periodicidade</div>
            {(editing.pm_plan||[]).map((p:any,i:number) => (
              <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-1.5 text-xs" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>
                <div><span className="px-1.5 py-0.5 rounded text-xs font-bold mr-2" style={{background:'rgba(0,212,255,.12)',color:'var(--cy)'}}>{PERIOD_LABEL[p.period]||p.period}</span>{p.task}</div>
                <button onClick={()=>rmPM(i)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'16px',lineHeight:1}}>×</button>
              </div>
            ))}
            <div className="rounded-xl p-2.5 mt-2" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Ex: Trocar filtro" className="col-span-2 rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s3)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}} onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
                <select value={newPeriod} onChange={e=>setNewPeriod(e.target.value)} className="rounded-xl px-2 py-2 text-xs outline-none col-span-2" style={{background:'var(--s3)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
                  {Object.entries(PERIOD_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <Btn onClick={addPM} size="sm" variant="primary" className="w-full">+ Adicionar Tarefa</Btn>
            </div>
          </div>
        )}

        {tab==='hours' && editing.id && (
          <div>
            <div className="text-xs mb-3" style={{color:'var(--t2)'}}>Registro de horas do horímetro</div>
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Horas Atuais (h)" value={editing.current_hours} onChange={(v:string)=>setEditing(e=>({...e,current_hours:parseFloat(v)||0}))} type="number" />
              <Input label="Intervalo Troca (h)" value={editing.oil_interval} onChange={(v:string)=>setEditing(e=>({...e,oil_interval:parseFloat(v)||250}))} type="number" />
              <Input label="Horas Últ. Troca" value={editing.last_oil_hours} onChange={(v:string)=>setEditing(e=>({...e,last_oil_hours:parseFloat(v)||0}))} type="number" />
              <Input label="Data Últ. Troca" value={editing.last_oil_date} onChange={(v:string)=>setEditing(e=>({...e,last_oil_date:v}))} type="date" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
