'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
const DEFAULT_ITEMS = ['Limpeza geral','EPI em uso','Extintores verificados','Sinalização ok','Ferramentas organizadas','Vazamentos visíveis','Ruídos anormais','Temperatura normal']

export default function AuditPage({ profile, can }: Props) {
  const [audits, setAudits] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [view, setView] = useState<any>(null)
  const [editing, setEditing] = useState<any>({})
  const [checkItems, setCheckItems] = useState<{label:string;ok:boolean|null;note:string}[]>([])
  const [loading, setLoading] = useState(true)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); supabase.from('machines').select('id,name,icon').then(({data})=>setMachines(data||[])) }, [])

  async function load() {
    const { data, error } = await supabase.from('audits').select('*').order('audit_date',{ascending:false}).order('created_at',{ascending:false})
    if (error) toast.error(error.message)
    setAudits(data||[]); setLoading(false)
  }

  function openNew() {
    setEditing({audit_date:td(),type:'Inspeção diária'})
    setCheckItems(DEFAULT_ITEMS.map(l=>({label:l,ok:null,note:''})))
    setModal(true)
  }

  async function save() {
    if (!editing.title&&!editing.type) { toast.error('Informe o tipo de auditoria'); return }
    const total = checkItems.length; const passed = checkItems.filter(i=>i.ok===true).length; const failed = checkItems.filter(i=>i.ok===false).length
    const obj = { title:editing.title||editing.type, type:editing.type||'Inspeção', machine_id:editing.machine_id||null, machine_name:machines.find(m=>m.id===editing.machine_id)?.name||'', audit_date:editing.audit_date||td(), auditor:profile?.display_name||'', items:checkItems, total_items:total, passed_items:passed, failed_items:failed, score:total>0?Math.round((passed/total)*100):0, notes:editing.notes, status:failed===0?'approved':'issues' }
    const { error } = await supabase.from('audits').insert(obj)
    if (error) { toast.error(error.message); return }
    toast.success(`Auditoria registrada — Score: ${obj.score}% ✅`); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir auditoria?')) return
    const { error } = await supabase.from('audits').delete().eq('id',id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído'); load()
  }

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="🔍 Auditorias e Checklists" action={<Btn onClick={openNew} variant="primary" size="sm">+ Nova</Btn>} />

      {loading ? <Empty icon="⏳" text="Carregando..." /> : audits.length===0 ? <Empty icon="🔍" text="Nenhuma auditoria registrada." /> : (
        <div className="flex flex-col gap-2">
          {audits.map(a=>(
            <div key={a.id} onClick={()=>setView(a)} className="rounded-xl p-3 cursor-pointer" style={{background:'var(--s1)',border:`1px solid ${a.status==='issues'?'rgba(239,68,68,.3)':'var(--bd)'}`}}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm" style={{color:a.score>=90?'#22c55e':a.score>=70?'#f59e0b':'#ef4444'}}>{a.score}%</span>
                    <Badge color={a.status==='approved'?'green':'red'}>{a.status==='approved'?'✅ Aprovado':'⚠️ Pendências'}</Badge>
                  </div>
                  <div className="font-semibold text-xs">{a.title}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>📅 {fmtD(a.audit_date)} · 👤 {a.auditor}{a.machine_name?' · ⚙️ '+a.machine_name:''}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>✅ {a.passed_items} ok · ❌ {a.failed_items} falhas · Total {a.total_items}</div>
                </div>
                <Btn onClick={e=>{e.stopPropagation();del(a.id)}} variant="danger" size="sm">🗑</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View modal */}
      <Modal open={!!view} onClose={()=>setView(null)} title="Detalhes da Auditoria">
        {view&&<>
          <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{background:'var(--s2)'}}>
            <div style={{fontSize:'28px',fontWeight:800,color:view.score>=90?'#22c55e':view.score>=70?'#f59e0b':'#ef4444'}}>{view.score}%</div>
            <div><div className="font-bold text-sm">{view.title}</div><div className="text-xs" style={{color:'var(--t3)'}}>{fmtD(view.audit_date)} · {view.auditor}</div></div>
          </div>
          {(view.items||[]).map((it:any,i:number)=>(
            <div key={i} className="flex items-center gap-2 py-1.5 border-b" style={{borderColor:'var(--bd)'}}>
              <span style={{fontSize:'14px'}}>{it.ok===true?'✅':it.ok===false?'❌':'⬜'}</span>
              <span className="text-xs flex-1">{it.label}</span>
              {it.note&&<span className="text-xs" style={{color:'var(--t3)'}}>{it.note}</span>}
            </div>
          ))}
          {view.notes&&<div className="mt-2 text-xs p-2 rounded-lg" style={{background:'var(--s2)',color:'var(--t2)'}}>{view.notes}</div>}
        </>}
      </Modal>

      {/* New audit modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title="Nova Auditoria / Checklist"
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={save} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Título" value={editing.title} onChange={(v:string)=>setEditing((e:any)=>({...e,title:v}))} placeholder="Ex: Inspeção diária linha 2" />
        <div className="grid grid-cols-2 gap-x-3">
          <Select label="Tipo" value={editing.type||'Inspeção diária'} onChange={(v:string)=>setEditing((e:any)=>({...e,type:v}))} options={['Inspeção diária','Inspeção semanal','Auditoria mensal','Checklist de segurança','Outro']} />
          <Input label="Data" value={editing.audit_date||td()} onChange={(v:string)=>setEditing((e:any)=>({...e,audit_date:v}))} type="date" />
        </div>
        <Select label="Máquina (opcional)" value={editing.machine_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,machine_id:v}))} options={[{value:'',label:'Inspeção geral'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <div style={{fontSize:'10px',fontWeight:700,color:'rgba(249,115,22,.7)',textTransform:'uppercase',letterSpacing:'.5px',margin:'8px 0 6px'}}>Checklist</div>
        {checkItems.map((ci,i)=>(
          <div key={i} className="flex items-center gap-2 mb-2">
            <div className="flex gap-1">
              <button onClick={()=>setCheckItems(items=>items.map((x,j)=>j===i?{...x,ok:true}:x))} style={{width:'26px',height:'26px',borderRadius:'6px',border:'1px solid',borderColor:ci.ok===true?'#22c55e':'var(--bd)',background:ci.ok===true?'rgba(34,197,94,.15)':'transparent',cursor:'pointer',fontSize:'13px'}}>✅</button>
              <button onClick={()=>setCheckItems(items=>items.map((x,j)=>j===i?{...x,ok:false}:x))} style={{width:'26px',height:'26px',borderRadius:'6px',border:'1px solid',borderColor:ci.ok===false?'#ef4444':'var(--bd)',background:ci.ok===false?'rgba(239,68,68,.15)':'transparent',cursor:'pointer',fontSize:'13px'}}>❌</button>
            </div>
            <span className="text-xs flex-1">{ci.label}</span>
            {ci.ok===false&&<input value={ci.note} onChange={e=>setCheckItems(items=>items.map((x,j)=>j===i?{...x,note:e.target.value}:x))} placeholder="Observação..." style={{width:'80px',fontSize:'10px',background:'var(--s3)',border:'1px solid var(--bd)',borderRadius:'6px',padding:'3px 6px',color:'var(--t1)',fontFamily:'Sora,system-ui'}} />}
          </div>
        ))}
        <Input label="Observações gerais" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} placeholder="Comentários adicionais..." />
      </Modal>
    </div>
  )
}
