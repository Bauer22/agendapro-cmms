'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm, Chips } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const STATUS_OPTS = [{value:'pending',label:'⏳ Pendente'},{value:'paid',label:'✅ Pago'},{value:'overdue',label:'🔴 Vencido'},{value:'cancelled',label:'⚫ Cancelado'}]
const STATUS_COLOR: Record<string,string> = {pending:'amber',paid:'green',overdue:'red',cancelled:'gray'}
const STATUS_LABEL: Record<string,string> = {pending:'Pendente',paid:'Pago',overdue:'Vencido',cancelled:'Cancelado'}

export default function FinancePage({ profile, can }: Props) {
  const [bills, setBills]       = useState<any[]>([])
  const [centers, setCenters]   = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoad]      = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEdit]      = useState<any>({})
  const [tab, setTab]           = useState('bills')
  const [fixed, setFixed]       = useState<any[]>([])
  const [fixModal, setFixModal] = useState(false)
  const [editFix, setEditFix]   = useState<any>({})
  const [fStatus, setFStatus]   = useState('')
  const [search, setSearch]     = useState('')
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load() }, [tab])

  async function load() {
    if (tab === 'bills') {
      const [b, c, s] = await Promise.all([
        supabase.from('accounts_payable').select('*').order('due_date',{ascending:false}),
        supabase.from('cost_centers').select('*').eq('active', true),
        supabase.from('cadastros').select('id,nome_razao,nome_fantasia').eq('is_fornecedor',true).eq('status',true),
      ])
      setBills(b.data||[]); setCenters(c.data||[]); setSuppliers(s.data||[])
    } else if (tab === 'fixed') {
      const [f, c2] = await Promise.all([
        supabase.from('fixed_expenses').select('*').order('description'),
        supabase.from('cost_centers').select('*').eq('active', true),
      ])
      setFixed(f.data||[]); setCenters(c2.data||[])
    } else {
      const { data } = await supabase.from('cost_centers').select('*').order('codigo')
      setCenters(data||[])
    }
    setLoad(false)
  }

  async function saveFixed() {
    if (!editFix.description?.trim()) { toast.error('Informe a descrição'); return }
    if (!editFix.value) { toast.error('Informe o valor'); return }
    const obj = {
      description: editFix.description.trim(),
      value: parseFloat(editFix.value),
      centro_custo_id: editFix.centro_custo_id||null,
      due_day: parseInt(editFix.due_day)||5,
      active: editFix.active !== false,
      notes: editFix.notes||null,
    }
    const { error } = editFix.id
      ? await supabase.from('fixed_expenses').update(obj).eq('id', editFix.id)
      : await supabase.from('fixed_expenses').insert({...obj, company_id: profile?.company_id||null})
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success(editFix.id?'Atualizado ✅':'Despesa fixa criada ✅')
    setFixModal(false); setEditFix({}); load()
  }

  async function gerarMes() {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const ativas = fixed.filter(f => f.active !== false)
    if (ativas.length === 0) { toast.error('Nenhuma despesa fixa ativa'); return }
    const jaGeradas = ativas.filter(f => (f.last_generated||'').startsWith(ym))
    if (jaGeradas.length === ativas.length) { toast.error('Despesas deste mês já foram geradas'); return }
    if (!await confirm(`Gerar ${ativas.length - jaGeradas.length} lançamento(s) de ${ym} em Contas a Pagar?`)) return

    const pend = ativas.filter(f => !(f.last_generated||'').startsWith(ym))
    const rows = pend.map(f => ({
      descricao: f.description,
      valor: parseFloat(f.value),
      centro_custo_id: f.centro_custo_id,
      due_date: `${ym}-${String(f.due_day||5).padStart(2,'0')}`,
      status: 'pending',
      company_id: profile?.company_id||null,
      created_by: profile?.display_name||'',
      created_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('accounts_payable').insert(rows)
    if (error) { toast.error('Erro: '+error.message); return }
    await supabase.from('fixed_expenses').update({ last_generated: `${ym}-01` }).in('id', pend.map(f=>f.id))
    toast.success(`${rows.length} lançamento(s) gerado(s) ✅`)
    load()
  }

  async function saveBill() {
    if (!editing.fornecedor_id) { toast.error('Selecione o fornecedor'); return }
    if (!editing.valor)         { toast.error('Informe o valor'); return }
    try {
      const obj = { ...editing, created_by: profile?.display_name||profile?.email, created_at: new Date().toISOString() }
      if (editing.id) {
        const { error } = await supabase.from('accounts_payable').update(obj).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('accounts_payable').insert(obj)
        if (error) throw error
      }
      toast.success('Salvo ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function saveCenter() {
    if (!editing.descricao) { toast.error('Informe a descrição'); return }
    try {
      const obj = { ...editing, active: true }
      if (editing.id) {
        const { error: eCc } = await supabase.from('cost_centers').update(obj).eq('id', editing.id)
        if (eCc) { toast.error('Erro: '+eCc.message); return }
      } else {
        const { error: eCc2 } = await supabase.from('cost_centers').insert(obj)
        if (eCc2) { toast.error('Erro: '+eCc2.message); return }
      }
      toast.success('Centro de custo salvo ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function markPaid(id: string) {
    const { error: ePay } = await supabase.from('accounts_payable').update({ status:'paid', data_recebimento: td() }).eq('id', id)
    if (ePay) { toast.error('Erro: '+ePay.message); return }
    toast.success('Marcado como pago ✅'); load()
  }

  async function del(id: string, tbl: string) {
    if (!await confirm('Excluir este registro?')) return
    const { error: eDel } = await supabase.from(tbl).delete().eq('id', id)
    if (eDel) { toast.error('Erro: '+eDel.message); return }
    toast.success('Excluído'); load()
  }

  // Stats
  const today = td()
  const totalPending = bills.filter(b=>b.status==='pending').reduce((s,b)=>s+(b.valor||0),0)
  const totalOverdue = bills.filter(b=>b.status==='pending'&&b.due_date<today).reduce((s,b)=>s+(b.valor||0),0)
  const totalPaid    = bills.filter(b=>b.status==='paid').reduce((s,b)=>s+(b.valor||0),0)

  const filtered = bills.filter(b => {
    const sup = suppliers.find(s=>s.id===b.fornecedor_id)
    const q = search.toLowerCase()
    return (!fStatus||b.status===fStatus) &&
      (!q||(sup?.nome_razao||'').toLowerCase().includes(q)||(b.numero_documento||'').toLowerCase().includes(q))
  })

  return (
    <div>
      {dialog}
      {/* Tabs */}
      <div className="flex gap-1.5 mb-3">
        {[{k:'bills',l:'💰 Contas'},{k:'fixed',l:'🔁 Fixas'},{k:'centers',l:'📊 Centros'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='fixed' && (
        <>
          <div className="flex gap-2 mb-3">
            <Btn onClick={()=>{setEditFix({active:true,due_day:5});setFixModal(true)}} variant="secondary" size="sm">+ Nova Fixa</Btn>
            <Btn onClick={gerarMes} variant="primary" size="sm">🔁 Gerar mês atual</Btn>
          </div>
          <div style={{fontSize:'10px',color:'var(--t3)',marginBottom:'8px'}}>
            Despesas recorrentes. Clique em "Gerar mês atual" para lançá-las em Contas a Pagar.
          </div>
          {fixed.length===0 ? <Empty icon="🔁" text="Nenhuma despesa fixa cadastrada." /> : (
            <div className="flex flex-col gap-2">
              {fixed.map(f => {
                const cc = centers.find(x=>x.id===f.centro_custo_id)
                const now = new Date()
                const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
                const done = (f.last_generated||'').startsWith(ym)
                return (
                  <div key={f.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)',opacity:f.active===false?0.55:1}}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm">{f.description}</span>
                          {done && <Badge color="green">✓ mês gerado</Badge>}
                          {f.active===false && <Badge color="gray">Inativa</Badge>}
                        </div>
                        <div className="text-xs font-bold" style={{color:'var(--cy)'}}>
                          R$ {(parseFloat(f.value)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t3)'}}>
                          📅 Vence dia {f.due_day||5}{cc?' · 📊 '+cc.descricao:''}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Btn onClick={()=>{setEditFix(f);setFixModal(true)}} size="sm">✏️</Btn>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="rounded-xl p-3 mt-1" style={{background:'rgba(249,115,22,.08)',border:'1px solid rgba(249,115,22,.3)'}}>
                <div className="flex justify-between" style={{fontSize:'13px',fontWeight:700}}>
                  <span>Total mensal fixo</span>
                  <span style={{color:'#f97316'}}>
                    R$ {fixed.filter(f=>f.active!==false).reduce((s,f)=>s+(parseFloat(f.value)||0),0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Modal open={fixModal} onClose={()=>setFixModal(false)}
            title={editFix.id?'Editar Despesa Fixa':'Nova Despesa Fixa'}
            footer={<><Btn onClick={()=>setFixModal(false)}>Cancelar</Btn><Btn onClick={saveFixed} variant="primary" size="md">Salvar</Btn></>}>
            <Input label="Descrição *" value={editFix.description} onChange={(v:string)=>setEditFix((e:any)=>({...e,description:v}))} placeholder="Ex: Aluguel" />
            <div className="grid grid-cols-2 gap-x-3">
              <Input label="Valor R$ *" value={editFix.value} onChange={(v:string)=>setEditFix((e:any)=>({...e,value:v}))} type="number" placeholder="0.00" />
              <Input label="Dia vencimento" value={editFix.due_day} onChange={(v:string)=>setEditFix((e:any)=>({...e,due_day:v}))} type="number" placeholder="5" />
            </div>
            <Select label="Centro de Custo" value={editFix.centro_custo_id||''} onChange={(v:string)=>setEditFix((e:any)=>({...e,centro_custo_id:v}))}
              options={[{value:'',label:'Nenhum'},...centers.map(c2=>({value:c2.id,label:`${c2.codigo} - ${c2.descricao}`}))]} />
            <Select label="Status" value={editFix.active===false?'0':'1'} onChange={(v:string)=>setEditFix((e:any)=>({...e,active:v==='1'}))}
              options={[{value:'1',label:'✅ Ativa'},{value:'0',label:'⛔ Inativa'}]} />
          </Modal>
        </>
      )}

      {tab==='bills' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              {label:'A Pagar',value:`R$ ${totalPending.toLocaleString('pt-BR',{minimumFractionDigits:2})}`,color:'var(--am)'},
              {label:'Vencido',value:`R$ ${totalOverdue.toLocaleString('pt-BR',{minimumFractionDigits:2})}`,color:'var(--rd)'},
              {label:'Pago',   value:`R$ ${totalPaid.toLocaleString('pt-BR',{minimumFractionDigits:2})}`,color:'var(--gn)'},
            ].map(k=>(
              <div key={k.label} className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="absolute top-0 inset-x-0 h-0.5" style={{background:k.color}}/>
                <div className="text-sm font-bold" style={{color:k.color}}>{k.value}</div>
                <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>{k.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-2">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Fornecedor ou Nº doc..."
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
              style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
              onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
            {can('admin')&&<Btn onClick={()=>{setEdit({status:'pending',data_emissao:td()});setModal(true)}} size="sm" variant="primary">+ Nova</Btn>}
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{scrollbarWidth:'none'}}>
            {[{value:'',label:'Todas'},...STATUS_OPTS.map(s=>({value:s.value,label:STATUS_LABEL[s.value]}))].map(s=>(
              <button key={s.value} onClick={()=>setFStatus(s.value)} className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer"
                style={{background:fStatus===s.value?'var(--cy)':'transparent',color:fStatus===s.value?'#000':'var(--t2)',borderColor:fStatus===s.value?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
                {s.label}
              </button>
            ))}
          </div>

          {loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : filtered.length===0 ? <Empty icon="💰" text="Nenhuma conta encontrada" /> : (
            <div className="flex flex-col gap-2">
              {filtered.map(b => {
                const sup = suppliers.find(s=>s.id===b.fornecedor_id)
                const center = centers.find(c=>c.id===b.centro_custo_id)
                const isOverdue = b.status==='pending' && b.due_date && b.due_date < today
                const status = isOverdue ? 'overdue' : b.status
                return (
                  <div key={b.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:`1px solid ${isOverdue?'rgba(239,68,68,.4)':'var(--bd)'}`}}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="text-xs font-bold truncate">{sup?.nome_razao||sup?.nome_fantasia||'Fornecedor'}</div>
                          <Badge color={STATUS_COLOR[status] as any}>{STATUS_LABEL[status]}</Badge>
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>
                          {b.numero_documento&&`Nº ${b.numero_documento} · `}Venc: {fmtD(b.due_date)}
                          {center&&` · ${center.descricao}`}
                        </div>
                        <div className="text-base font-bold mt-1" style={{color:'var(--cy)'}}>
                          R$ {Number(b.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {b.status==='pending'&&<button onClick={()=>markPaid(b.id)} className="text-xs px-2 py-1 rounded-lg font-bold cursor-pointer" style={{background:'rgba(16,185,129,.15)',color:'var(--gn)',border:'1px solid rgba(16,185,129,.3)'}}>✅ Pagar</button>}
                        {can('admin')&&<button onClick={()=>{setEdit({...b});setModal(true)}} className="text-xs px-2 py-1 rounded-lg cursor-pointer" style={{background:'var(--s2)',color:'var(--t2)',border:'1px solid var(--bd)'}}>✏️</button>}
                        {can('admin')&&<button onClick={()=>del(b.id,'accounts_payable')} className="text-xs px-2 py-1 rounded-lg cursor-pointer" style={{background:'transparent',color:'var(--rd)',border:'none'}}>🗑️</button>}
                      </div>
                    </div>
                    {b.observacao&&<div className="text-xs mt-1.5 px-2 py-1 rounded-lg" style={{background:'var(--s2)',color:'var(--t3)'}}>{b.observacao}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Bill Modal */}
          <Modal open={modal&&tab==='bills'} onClose={()=>setModal(false)} title={editing.id?'Editar Conta':'Nova Conta a Pagar'}
            footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveBill} variant="primary" size="md">Salvar</Btn></>}>
            <Select label="Fornecedor *" value={editing.fornecedor_id} onChange={(v:string)=>setEdit((e:any)=>({...e,fornecedor_id:v}))}
              options={[{value:'',label:'Selecione...'},...suppliers.map(s=>({value:s.id,label:s.nome_razao||s.nome_fantasia}))]} />
            <Select label="Centro de Custo" value={editing.centro_custo_id} onChange={(v:string)=>setEdit((e:any)=>({...e,centro_custo_id:v}))}
              options={[{value:'',label:'Nenhum'},...centers.map(c=>({value:c.id,label:`${c.codigo} - ${c.descricao}`}))]} />
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Nº Documento" value={editing.numero_documento} onChange={(v:string)=>setEdit((e:any)=>({...e,numero_documento:v}))} placeholder="NF-001" />
              <Input label="Valor R$ *" value={editing.valor} onChange={(v:string)=>setEdit((e:any)=>({...e,valor:parseFloat(v)||0}))} type="number" placeholder="0.00" />
              <Input label="Emissão" value={editing.data_emissao} onChange={(v:string)=>setEdit((e:any)=>({...e,data_emissao:v}))} type="date" />
              <Input label="Vencimento" value={editing.due_date} onChange={(v:string)=>setEdit((e:any)=>({...e,due_date:v}))} type="date" />
            </div>
            <Select label="Status" value={editing.status} onChange={(v:string)=>setEdit((e:any)=>({...e,status:v}))} options={STATUS_OPTS} />
            {editing.status==='paid'&&<Input label="Data Pagamento" value={editing.data_recebimento} onChange={(v:string)=>setEdit((e:any)=>({...e,data_recebimento:v}))} type="date" />}
            <Textarea label="Observação" value={editing.observacao} onChange={(v:string)=>setEdit((e:any)=>({...e,observacao:v}))} rows={2} />
          </Modal>
        </>
      )}

      {tab==='centers' && (
        <>
          <SH label={`Centros de Custo (${centers.length})`} action={can('admin')&&<Btn onClick={()=>{setEdit({active:true});setModal(true)}} size="sm" variant="primary">+ Novo</Btn>} />
          {centers.length===0 ? <Empty icon="📊" text="Nenhum centro de custo" /> : (
            <div className="flex flex-col gap-2">
              {centers.map(c=>(
                <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                  <div className="text-xl">📊</div>
                  <div className="flex-1">
                    <div className="text-xs font-bold">{c.codigo} — {c.descricao}</div>
                    {c.grupo&&<div className="text-xs" style={{color:'var(--t3)'}}>{c.grupo}</div>}
                  </div>
                  {can('admin')&&<button onClick={()=>{setEdit({...c});setModal(true)}} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'14px'}}>✏️</button>}
                  {can('admin')&&<button onClick={()=>del(c.id,'cost_centers')} style={{background:'none',border:'none',color:'var(--rd)',cursor:'pointer',fontSize:'14px'}}>🗑️</button>}
                </div>
              ))}
            </div>
          )}
          <Modal open={modal&&tab==='centers'} onClose={()=>setModal(false)} title={editing.id?'Editar Centro':'Novo Centro de Custo'}
            footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveCenter} variant="primary" size="md">Salvar</Btn></>}>
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Código" value={editing.codigo} onChange={(v:string)=>setEdit((e:any)=>({...e,codigo:v}))} placeholder="CC-001" />
              <Input label="Grupo" value={editing.grupo} onChange={(v:string)=>setEdit((e:any)=>({...e,grupo:v}))} placeholder="Produção" />
            </div>
            <Input label="Descrição *" value={editing.descricao} onChange={(v:string)=>setEdit((e:any)=>({...e,descricao:v}))} placeholder="Manutenção Geral" />
          </Modal>
        </>
      )}
    </div>
  )
}
