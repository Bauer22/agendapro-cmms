'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Maintenance, UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const TYPES = ['Preventiva','Corretiva','Preditiva','Lubrificação','Troca de óleo','Troca de peça','Inspeção','Calibração','Limpeza','Outro']
const RESULTS = [{value:'ok',label:'✅ Normalizado'},{value:'monitoring',label:'👁️ Monitorando'},{value:'pending',label:'⏳ Ag. peça'},{value:'stopped',label:'🔴 Parado'}]
const RESULT_LABELS: Record<string,string> = {ok:'✅ Normalizado',monitoring:'👁️ Monitorando',pending:'⏳ Ag. peça',stopped:'🔴 Parado'}
const RESULT_COLORS: Record<string,string> = {ok:'green',monitoring:'amber',pending:'blue',stopped:'red'}
const STATUS_OPTS = [{value:'open',label:'🔵 Em aberto'},{value:'progress',label:'🟡 Em andamento'},{value:'done',label:'✅ Finalizado'}]

export default function MaintPage({ profile, can }: Props) {
  const [recs, setRecs]     = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [machines, setMach] = useState<any[]>([])
  const [loading, setLoad]  = useState(true)
  const [modal, setModal]   = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [selected, setSelected]  = useState<any>(null)
  const [buscaMaint, setBuscaMaint] = useState('')
  const [editing, setEdit]  = useState<any>({})
  const [fMach, setFMach]   = useState('')
  const [fType, setFType]   = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fFrom, setFFrom]   = useState('')
  const [fTo, setFTo]       = useState('')
  const [aba, setAba]       = useState<'registros'|'dashboard'>('registros')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    const [r, m] = await Promise.all([
      supabase.from('maintenance').select('*').order('date',{ascending:false}).order('created_at',{ascending:false}).limit(100),
      supabase.from('machines').select('id,name,icon,code,current_hours'),
    ])
    setRecs(r.data||[]); setMach(m.data||[]); setLoad(false)
  }

  function openNew(machineId?: string) {
    setEdit({ date: td(), result:'ok', type:'Preventiva', status:'open', machine_id: machineId, resp: profile?.display_name||'' })
    setModal(true)
  }

  function openEdit(rec: any) {
    setEdit({...rec}); setViewModal(false); setModal(true)
  }

  async function finalize(rec: any) {
    if (!await confirm(`Finalizar este registro de manutenção?`)) return
    const { error } = await supabase.from('maintenance').update({ status:'done', close_date: td() }).eq('id', rec.id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Manutenção finalizada ✅'); load()
  }

  async function save() {
    if (saving) return
    setSaving(true)
    if (!editing.machine_id) { toast.error('Selecione a máquina'); setSaving(false); return }
    if (!editing.resp)       { toast.error('Informe o responsável'); setSaving(false); return }
    const mach = machines.find(m=>m.id===editing.machine_id)
    const obj = { ...editing, machine_name: mach?.name, created_by: profile?.display_name||profile?.email }
    try {
      if (editing.id) {
        const { error } = await supabase.from('maintenance').update(obj).eq('id', editing.id)
        if (error) throw error
        setSaving(false)
        toast.success('Manutenção atualizada ✅')
      } else {
        const { error } = await supabase.from('maintenance').insert({ ...obj, status: obj.status||'open', created_at: new Date().toISOString() })
        if (error) throw error
        // Update oil if oil change
        if (editing.type === 'Troca de óleo' && mach) {
          const { data: machData } = await supabase.from('machines').select('current_hours,category').eq('id', editing.machine_id).single()
          if (machData?.category === 'transport') {
            const { error: eMu } = await supabase.from('machines').update({ last_oil_hours: machData.current_hours, last_oil_date: editing.date }).eq('id', editing.machine_id)
          if (eMu) toast.error('Erro ao atualizar máquina: '+eMu.message)
          }
        }
        setSaving(false)
        toast.success('Manutenção registrada ✅')
      }
      setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function del(id: string) {
    if (!await confirm('Excluir este registro?')) return
    const { error: eDel } = await supabase.from('maintenance').delete().eq('id', id)
    if (eDel) { toast.error('Erro: '+eDel.message); return }
    toast.success('Excluído'); setViewModal(false); load()
  }

  const filtered = recs.filter(r => {
    if (fMach && r.machine_id!==fMach) return false
    if (fType && r.type!==fType) return false
    if (fStatus && r.status!==fStatus) return false
    if (fFrom && String(r.date||'') < fFrom) return false
    if (fTo && String(r.date||'') > fTo) return false
    const q = buscaMaint.trim().toLowerCase()
    if (!q) return true
    const campos = [r.machine_name, r.type, r.resp, r.result, r.status, r.date, r.duration, r.description].map(x => (x===null||x===undefined)?'':String(x).toLowerCase())
    return campos.some(c => c.includes(q))
  })

  // Stats (respeitam os filtros aplicados)
  const open     = filtered.filter(r=>r.status==='open'||!r.status).length
  const progress = filtered.filter(r=>r.status==='progress').length
  const done     = filtered.filter(r=>r.status==='done').length
  const custoTotal = filtered.reduce((s,r)=> s + (Number(r.cost)||0), 0)

  // ── Agregações para o DASHBOARD (sobre os registros filtrados) ──
  function agrupar(keyFn:(r:any)=>string, valFn:(r:any)=>number) {
    const m = new Map<string,number>()
    filtered.forEach(r=>{ const k=keyFn(r); if(!k) return; m.set(k,(m.get(k)||0)+valFn(r)) })
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1])
  }
  const porMaquina = agrupar(r=>{const mm=machines.find(x=>x.id===r.machine_id);return mm?.name||r.machine_name||'—'}, ()=>1)
  const porTipo    = agrupar(r=>r.type||'—', ()=>1)
  const custoPorMaquina = agrupar(r=>{const mm=machines.find(x=>x.id===r.machine_id);return mm?.name||r.machine_name||'—'}, r=>Number(r.cost)||0).filter(x=>x[1]>0)
  const porMes = (()=>{
    const m = new Map<string,number>()
    filtered.forEach(r=>{ const d=String(r.date||''); if(d.length<7) return; const k=d.slice(0,7); m.set(k,(m.get(k)||0)+1) })
    return Array.from(m.entries()).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)
  })()

  async function gerarRelatorioPDF() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const { addReportLogo } = await import('@/lib/pdf')
      const doc = new jsPDF()
      await addReportLogo(doc)
      doc.setFontSize(15); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
      doc.text('Relatório de Manutenção', 12, 18)
      doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80)
      let sub = 'Emitido em ' + new Date().toLocaleString('pt-BR')
      if (fMach) { const mm = machines.find(m=>m.id===fMach); if (mm) sub += ' · Máquina: ' + mm.name }
      if (fFrom || fTo) sub += ' · Período: ' + (fFrom?fFrom.split('-').reverse().join('/'):'início') + ' a ' + (fTo?fTo.split('-').reverse().join('/'):'hoje')
      doc.text(sub, 12, 24)

      const rows = [...filtered].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).map(r=>{
        const mm = machines.find(m=>m.id===r.machine_id)
        return [
          r.date ? new Date(r.date+'T00:00:00').toLocaleDateString('pt-BR') : '-',
          mm?.name || r.machine_name || '-',
          r.type || '-',
          r.description || r.parts || '-',
          r.hour_meter!=null ? String(r.hour_meter) : '-',
          r.next_change!=null ? String(r.next_change) : '-',
          r.cost!=null ? ('R$ '+Number(r.cost).toLocaleString('pt-BR',{minimumFractionDigits:2})) : '-',
        ]
      })
      autoTable(doc, {
        startY: 30,
        head: [['Data','Máquina','Tipo','Serviço','Hora-máq','Próx. troca','Custo']],
        body: rows,
        theme:'grid',
        headStyles:{fillColor:[249,115,22]},
        bodyStyles:{textColor:[20,20,20]},
        styles:{fontSize:8},
        columnStyles:{4:{halign:'right'},5:{halign:'right'},6:{halign:'right'}}
      })
      let y = (doc as any).lastAutoTable.finalY + 8
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
      doc.text('Total de registros: ' + filtered.length, 12, y); y += 6
      doc.text('Custo total (informativo): R$ ' + custoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2}), 12, y); y += 10

      // ── Resumo por máquina ──
      if (porMaquina.length > 0) {
        if (y > 230) { doc.addPage(); y = 20 }
        doc.setFontSize(11); doc.text('Resumo por Máquina', 12, y)
        autoTable(doc, {
          startY: y+3,
          head: [['Máquina','Manutenções','Custo']],
          body: porMaquina.map(([nome,qtd])=>{
            const c = custoPorMaquina.find(x=>x[0]===nome)
            return [nome, String(qtd), c?('R$ '+c[1].toLocaleString('pt-BR',{minimumFractionDigits:2})):'-']
          }),
          theme:'grid', headStyles:{fillColor:[249,115,22]}, styles:{fontSize:8},
          columnStyles:{1:{halign:'right'},2:{halign:'right'}}
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }
      // ── Resumo por tipo ──
      if (porTipo.length > 0) {
        if (y > 240) { doc.addPage(); y = 20 }
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.text('Resumo por Tipo', 12, y)
        autoTable(doc, {
          startY: y+3,
          head: [['Tipo','Quantidade']],
          body: porTipo.map(([tipo,qtd])=>[tipo, String(qtd)]),
          theme:'grid', headStyles:{fillColor:[249,115,22]}, styles:{fontSize:8},
          columnStyles:{1:{halign:'right'}}
        })
      }
      doc.save(`manutencao_${td()}.pdf`)
      toast.success('Relatório gerado ✅')
    } catch(e:any){ toast.error('Erro ao gerar PDF: '+e.message) }
  }

  return (
    <div>
      {dialog}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[
          {l:'Em Aberto',  v:open,     c:'var(--cy)'},
          {l:'Andamento',  v:progress, c:'var(--am)'},
          {l:'Finalizadas',v:done,     c:'var(--gn)'},
        ].map(k=>(
          <div key={k.l} className="rounded-xl p-2.5 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div className="absolute top-0 inset-x-0 h-0.5" style={{background:k.c}}/>
            <div className="font-bebas text-2xl" style={{color:k.c}}>{k.v}</div>
            <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1.5 mb-3">
        {[{k:'registros',l:'📋 Registros'},{k:'dashboard',l:'📊 Dashboard'}].map(t=>(
          <button key={t.k} onClick={()=>setAba(t.k as any)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{background: aba===t.k?'var(--cy)':'var(--s1)', color: aba===t.k?'#061018':'var(--t2)', border:'1px solid var(--bd)'}}>{t.l}</button>
        ))}
      </div>

      {/* Filtros (valem para as duas abas) */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select value={fMach} onChange={e=>setFMach(e.target.value)} className="rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todas as máquinas</option>
          {machines.map(m=><option key={m.id} value={m.id}>{m.icon||'⚙️'} {m.name}</option>)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} className="rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
          <option value="">Todos os status</option>
          {STATUS_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase',fontWeight:700}}>De</label>
          <input type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)'}} />
        </div>
        <div>
          <label style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase',fontWeight:700}}>Até</label>
          <input type="date" value={fTo} onChange={e=>setFTo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)'}} />
        </div>
      </div>
      {(fFrom||fTo||fMach||fStatus) && (
        <button onClick={()=>{setFFrom('');setFTo('');setFMach('');setFStatus('')}} style={{fontSize:'10px',color:'var(--cy)',marginBottom:'8px'}}>✕ limpar filtros</button>
      )}

      {/* Busca (só na aba registros) */}
      {aba==='registros' && (
      <input value={buscaMaint} onChange={e=>setBuscaMaint(e.target.value)}
        placeholder="🔍 Buscar por máquina, tipo, responsável, resultado, data..."
        className="w-full rounded-xl px-3 py-2 text-xs outline-none mb-2"
        style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}} />
      )}

      <SH label={`Registros (${filtered.length})`} action={
        <div className="flex gap-1 items-center flex-wrap">
          {custoTotal>0 && <span style={{fontSize:'10px',color:'var(--t3)',marginRight:'4px'}}>💰 Custo: <b style={{color:'var(--am)'}}>R$ {custoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</b></span>}
          <Btn onClick={gerarRelatorioPDF} size="sm" variant="secondary">🖨️ Relatório</Btn>
          {can('maint')&&<Btn onClick={()=>openNew()} size="sm" variant="primary">+ Registrar</Btn>}
        </div>
      } />

      {aba==='dashboard' ? (
        <MaintDashboard filtered={filtered} porMes={porMes} porMaquina={porMaquina} porTipo={porTipo} custoPorMaquina={custoPorMaquina} custoTotal={custoTotal} open={open} progress={progress} done={done} />
      ) : (
      loading ? <div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div> : filtered.length===0 ? <Empty icon="🔧" text="Nenhum registro" /> : (
        <div className="flex flex-col gap-2">
          {filtered.map(r => {
            const mach = machines.find(m=>m.id===r.machine_id)
            const isDone = r.status==='done'
            const isProgress = r.status==='progress'
            const borderColor = isDone ? 'rgba(16,185,129,.3)' : isProgress ? 'rgba(245,158,11,.35)' : 'var(--bd)'
            return (
              <div key={r.id} onClick={()=>{setSelected(r);setViewModal(true)}} className="p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:`1px solid ${borderColor}`}}>
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 pt-0.5">{mach?.icon||'🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="text-xs font-semibold">{mach?.name||'Máquina'} — {r.type}</div>
                      <Badge color={isDone?'green':isProgress?'amber':'blue'}>{isDone?'Finalizado':isProgress?'Andamento':'Em aberto'}</Badge>
                    </div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>👤 {r.resp} · 📅 {fmtD(r.date)}{r.duration&&` · ⏱️ ${r.duration}h`}</div>
                    {r.description&&<div className="text-xs mt-1" style={{color:'var(--t3)'}}>{r.description.slice(0,70)}</div>}
                    <div className="text-xs mt-0.5">
                      <Badge color={RESULT_COLORS[r.result] as any}>{RESULT_LABELS[r.result]||r.result}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* View Modal */}
      {selected && (
        <Modal open={viewModal} onClose={()=>setViewModal(false)} title={`${selected.machine_name||'Manutenção'} — ${selected.type}`}
          footer={
            <div className="flex gap-2 w-full flex-wrap">
              <Btn onClick={()=>setViewModal(false)} variant="secondary" size="md">Fechar</Btn>
              {can('maint')&&<Btn onClick={()=>openEdit(selected)} variant="primary" size="md">✏️ Editar</Btn>}
              {can('maint')&&selected.status!=='done'&&<Btn onClick={()=>finalize(selected)} variant="secondary" size="md">✅ Finalizar</Btn>}
              {can('admin')&&<Btn onClick={()=>del(selected.id)} variant="danger" size="md">🗑️</Btn>}
            </div>
          }>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge color={selected.status==='done'?'green':selected.status==='progress'?'amber':'blue'}>
              {selected.status==='done'?'Finalizado':selected.status==='progress'?'Em andamento':'Em aberto'}
            </Badge>
            <Badge color={RESULT_COLORS[selected.result] as any}>{RESULT_LABELS[selected.result]}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            {[
              ['Responsável', selected.resp],
              ['Data', fmtD(selected.date)],
              ['Duração', selected.duration?`${selected.duration}h`:null],
              ['Tipo', selected.type],
              ['Hora-máquina', selected.hour_meter!=null?String(selected.hour_meter):null],
              ['Próxima troca', selected.next_change!=null?String(selected.next_change):null],
              ['Custo', selected.cost!=null?('R$ '+Number(selected.cost).toLocaleString('pt-BR',{minimumFractionDigits:2})):null],
              ['Abertura', fmtD(selected.date)],
              ['Fechamento', fmtD(selected.close_date)],
            ].filter(([,v])=>v).map(([k,v])=>(
              <div key={String(k)}>
                <div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',letterSpacing:'.4px'}}>{k}</div>
                <div className="font-semibold text-xs mt-0.5">{String(v)}</div>
              </div>
            ))}
          </div>
          {selected.description&&<div className="mb-2"><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',marginBottom:4}}>Descrição</div><div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>{selected.description}</div></div>}
          {selected.parts&&<div className="mb-2"><div style={{color:'var(--t3)',fontSize:'9px',textTransform:'uppercase',marginBottom:4}}>Peças</div><div className="text-xs" style={{color:'var(--t2)'}}>{selected.parts}</div></div>}
        </Modal>
      )}

      {/* Edit/Create Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing.id?'Editar Manutenção':'Registrar Manutenção'}
        footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={save} variant="primary" size="md" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn></>}>
        <Select label="Máquina *" value={editing.machine_id} onChange={(v:string)=>{
            const mm = machines.find(x=>x.id===v)
            // pré-preenche a hora-máquina com o horímetro atual (vindo das abastecidas),
            // só se o usuário ainda não digitou nada
            setEdit((e:any)=>({...e, machine_id:v, hour_meter: (e.hour_meter==null||e.hour_meter==='') ? (mm?.current_hours ?? e.hour_meter) : e.hour_meter}))
          }}
          options={[{value:'',label:'Selecione...'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
        <div className="grid grid-cols-2 gap-x-2">
          <Select label="Tipo *" value={editing.type} onChange={(v:string)=>setEdit((e:any)=>({...e,type:v}))} options={TYPES} />
          <Input label="Data *" value={editing.date} onChange={(v:string)=>setEdit((e:any)=>({...e,date:v}))} type="date" />
          <Input label="Responsável *" value={editing.resp} onChange={(v:string)=>setEdit((e:any)=>({...e,resp:v}))} placeholder="Nome do técnico" />
          <Input label="Duração (h)" value={editing.duration} onChange={(v:string)=>setEdit((e:any)=>({...e,duration:parseFloat(v)||undefined}))} type="number" placeholder="0.5" />
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Input label="Hora-máquina" value={editing.hour_meter} onChange={(v:string)=>setEdit((e:any)=>({...e,hour_meter:v===''?undefined:(parseFloat(v)||0)}))} type="number" placeholder="Ex: 3256" />
          <Input label="Próxima troca" value={editing.next_change} onChange={(v:string)=>setEdit((e:any)=>({...e,next_change:v===''?undefined:(parseFloat(v)||0)}))} type="number" placeholder="Ex: 4500" />
        </div>
        {(() => {
          const mm = machines.find((x:any)=>x.id===editing.machine_id)
          const atual = Number(mm?.current_hours)||0
          const prox = Number(editing.next_change)||0
          if (!mm || prox<=0) return null
          const falta = prox - atual
          return (
            <div style={{fontSize:'10px',color: falta<=0?'var(--rd)':falta<=50?'var(--am)':'var(--t3)',marginTop:'-4px',marginBottom:'6px'}}>
              ⛽ Horímetro atual da máquina (abastecidas): <b>{atual}</b> ·
              {falta>0 ? ` faltam ${falta.toFixed(0)}h para a próxima troca` : ` troca VENCIDA há ${Math.abs(falta).toFixed(0)}h`}
            </div>
          )
        })()}
        <Input label="Custo (R$) — informativo" value={editing.cost} onChange={(v:string)=>setEdit((e:any)=>({...e,cost:v===''?undefined:(parseFloat(v)||0)}))} type="number" placeholder="Ex: 850.00" />
        <div style={{fontSize:'9px',color:'var(--t3)',marginTop:'-4px',marginBottom:'6px'}}>
          ℹ️ Este custo é só para controle/relatório da manutenção. Não entra no custo de produção do Gerencial.
        </div>
        <Select label="Status" value={editing.status||'open'} onChange={(v:string)=>setEdit((e:any)=>({...e,status:v}))} options={STATUS_OPTS} />
        <Input label="Peças Utilizadas" value={editing.parts} onChange={(v:string)=>setEdit((e:any)=>({...e,parts:v}))} placeholder="Ex: Filtro AR-001..." />
        <Textarea label="Descrição do serviço" value={editing.description} onChange={(v:string)=>setEdit((e:any)=>({...e,description:v}))} rows={3} placeholder="Descreva o serviço..." />
        <Select label="Situação após" value={editing.result} onChange={(v:string)=>setEdit((e:any)=>({...e,result:v}))} options={RESULTS} />
        {editing.status==='done'&&<Input label="Data Fechamento" value={editing.close_date} onChange={(v:string)=>setEdit((e:any)=>({...e,close_date:v}))} type="date" />}
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD DE MANUTENÇÃO (gráficos SVG, sem dependência externa)
// ═══════════════════════════════════════════════════════════════
function MaintDashboard({ filtered, porMes, porMaquina, porTipo, custoPorMaquina, custoTotal, open, progress, done }: any) {
  const money = (v:number)=> 'R$ '+(Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})
  const mesLabel = (ym:string)=>{ const [a,m]=ym.split('-'); return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][(+m)-1]+'/'+a.slice(2) }

  if (filtered.length===0) return <Empty icon="📊" text="Sem dados no período/filtro selecionado" />

  // Barras horizontais reutilizáveis
  const Barras = ({dados, fmt, cor}:{dados:[string,number][], fmt?:(n:number)=>string, cor:string}) => {
    const max = Math.max(...dados.map(d=>d[1]), 1)
    return (
      <div className="flex flex-col gap-1.5">
        {dados.map(([nome,val])=>(
          <div key={nome}>
            <div className="flex justify-between" style={{fontSize:'10px',color:'var(--t2)',marginBottom:'2px'}}>
              <span className="truncate" style={{maxWidth:'70%'}}>{nome}</span>
              <b style={{color:'var(--t1)'}}>{fmt?fmt(val):val}</b>
            </div>
            <div style={{height:'7px',background:'var(--bd)',borderRadius:'4px',overflow:'hidden'}}>
              <div style={{width:`${(val/max)*100}%`,height:'100%',background:cor,borderRadius:'4px'}} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const Card = ({titulo, children}:{titulo:string, children:any}) => (
    <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
      <div style={{fontSize:'11px',fontWeight:700,color:'var(--cy)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>{titulo}</div>
      {children}
    </div>
  )

  // gráfico de linha (manutenções por mês)
  const maxMes = Math.max(...porMes.map((d:any)=>d[1]), 1)
  const W=300, H=90, pad=4
  const pts = porMes.map((d:any,i:number)=>{
    const x = pad + (porMes.length<=1?W/2:(i/(porMes.length-1))*(W-pad*2))
    const y = H-pad - (d[1]/maxMes)*(H-pad*2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <div className="rounded-xl p-2.5 text-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="font-bebas text-2xl" style={{color:'var(--cy)'}}>{filtered.length}</div>
          <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>Manutenções</div>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div className="font-bebas text-2xl" style={{color:'var(--am)'}}>{money(custoTotal)}</div>
          <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>Custo total</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[{l:'Em aberto',v:open,c:'var(--cy)'},{l:'Andamento',v:progress,c:'var(--am)'},{l:'Finalizadas',v:done,c:'var(--gn)'}].map(k=>(
          <div key={k.l} className="rounded-xl p-2 text-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div className="font-bebas text-xl" style={{color:k.c}}>{k.v}</div>
            <div style={{fontSize:'7px',color:'var(--t3)',textTransform:'uppercase'}}>{k.l}</div>
          </div>
        ))}
      </div>

      {porMes.length>0 && (
        <Card titulo="📈 Manutenções por mês">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="90" preserveAspectRatio="none">
            <polyline points={pts} fill="none" stroke="var(--cy)" strokeWidth="2" />
            {porMes.map((d:any,i:number)=>{
              const x = pad + (porMes.length<=1?W/2:(i/(porMes.length-1))*(W-pad*2))
              const y = H-pad - (d[1]/maxMes)*(H-pad*2)
              return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--cy)" />
            })}
          </svg>
          <div className="flex justify-between" style={{fontSize:'8px',color:'var(--t3)',marginTop:'2px'}}>
            {porMes.map((d:any)=><span key={d[0]}>{mesLabel(d[0])}</span>)}
          </div>
        </Card>
      )}

      <Card titulo="🔧 Manutenções por máquina">
        <Barras dados={porMaquina.slice(0,10)} cor="var(--cy)" />
      </Card>

      <Card titulo="🏷️ Manutenções por tipo">
        <Barras dados={porTipo} cor="var(--am)" />
      </Card>

      {custoPorMaquina.length>0 && (
        <Card titulo="💰 Custo por máquina">
          <Barras dados={custoPorMaquina.slice(0,10)} fmt={money} cor="var(--gn)" />
        </Card>
      )}
    </div>
  )
}
