'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
type Tab = 'abast'|'entradas'|'despesas'|'relatorio'

const EXP_CATS = ['Manutenção','Pneus','Seguro','IPVA','Licenciamento','Multa','Lavagem','Peças','Outros']
const money = (v:number) => `R$ ${(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`

export default function FuelPage({ profile, can }: Props) {
  const [tab, setTab] = useState<Tab>('abast')
  const [records, setRecords]   = useState<any[]>([])
  const [entries, setEntries]   = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [veiculos, setVeiculos] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // filtros do relatório
  const [rFrom, setRFrom] = useState(''); const [rTo, setRTo] = useState('')
  const [rVeic, setRVeic] = useState('')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { loadMeta(); loadAll() }, [])

  async function loadMeta() {
    const [v, m, mot, forn] = await Promise.all([
      supabase.from('veiculos').select('id,placa,tipo').eq('status',true).order('placa'),
      supabase.from('machines').select('id,name,icon'),
      supabase.from('cadastros').select('id,nome_razao').eq('is_motorista',true).eq('status',true),
      supabase.from('cadastros').select('id,nome_razao').eq('is_fornecedor',true).eq('status',true),
    ])
    setVeiculos(v.data||[]); setMachines(m.data||[])
    setMotoristas(mot.data||[]); setFornecedores(forn.data||[])
  }

  async function loadAll() {
    setLoading(true)
    const [r, e, x] = await Promise.all([
      supabase.from('fuel_records').select('*').order('record_date',{ascending:false}).limit(300),
      supabase.from('fuel_entries').select('*').order('entry_date',{ascending:false}).limit(200),
      supabase.from('vehicle_expenses').select('*').order('expense_date',{ascending:false}).limit(200),
    ])
    if (r.error) toast.error('Erro: '+r.error.message)
    setRecords(r.data||[]); setEntries(e.data||[]); setExpenses(x.data||[])
    setLoading(false)
  }

  // ── Estoque = entradas − abastecimentos ──
  const totalIn   = entries.reduce((s,e)=>s+(parseFloat(e.liters)||0),0)
  const totalOut  = records.reduce((s,r)=>s+(parseFloat(r.liters)||0),0)
  const stock     = totalIn - totalOut
  const avgPrice  = totalIn > 0 ? entries.reduce((s,e)=>s+(parseFloat(e.total_value)||0),0)/totalIn : 0

  function openNew() {
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    if (tab==='abast')    setEditing({ record_date: td(), record_time: hhmm })
    else if (tab==='entradas') setEditing({ entry_date: td() })
    else if (tab==='despesas') setEditing({ expense_date: td(), category:'Manutenção' })
    setModal(true)
  }

  async function save() {
    setSaving(true)
    let error = null

    if (tab === 'abast') {
      if (!editing.liters || parseFloat(editing.liters) <= 0) { toast.error('Informe os litros'); setSaving(false); return }
      if (!editing.veiculo_id && !editing.machine_id) { toast.error('Selecione um veículo OU uma máquina'); setSaving(false); return }
      const ve = veiculos.find(x=>x.id===editing.veiculo_id)
      const ma = machines.find(x=>x.id===editing.machine_id)
      const mo = motoristas.find(x=>x.id===editing.driver_id)
      const lt = parseFloat(editing.liters)
      const up = editing.unit_price ? parseFloat(editing.unit_price) : avgPrice
      const obj = {
        record_date: editing.record_date||td(), record_time: editing.record_time||null,
        veiculo_id: editing.veiculo_id||null, veiculo_placa: ve?.placa||null,
        machine_id: editing.machine_id||null, machine_name: ma?.name||null,
        km: editing.km ? parseFloat(editing.km) : null,
        hour_meter: editing.hour_meter ? parseFloat(editing.hour_meter) : null,
        liters: lt, unit_price: up || null, total_value: up ? lt*up : null,
        driver_id: editing.driver_id||null, driver_name: mo?.nome_razao||null,
        notes: editing.notes||null, created_by: profile?.display_name||'',
      }
      const res = editing.id
        ? await supabase.from('fuel_records').update(obj).eq('id',editing.id)
        : await supabase.from('fuel_records').insert({...obj, company_id: profile?.company_id||null})
      error = res.error

    } else if (tab === 'entradas') {
      if (!editing.liters || !editing.total_value) { toast.error('Informe litros e valor total'); setSaving(false); return }
      const lt = parseFloat(editing.liters), tv = parseFloat(editing.total_value)
      const fo = fornecedores.find(x=>x.id===editing.supplier_id)
      const obj = {
        entry_date: editing.entry_date||td(), liters: lt, total_value: tv,
        unit_price: lt > 0 ? tv/lt : null,
        supplier_id: editing.supplier_id||null, supplier_name: fo?.nome_razao||null,
        invoice: editing.invoice||null, notes: editing.notes||null,
        created_by: profile?.display_name||'',
      }
      const res = editing.id
        ? await supabase.from('fuel_entries').update(obj).eq('id',editing.id)
        : await supabase.from('fuel_entries').insert({...obj, company_id: profile?.company_id||null})
      error = res.error

    } else if (tab === 'despesas') {
      if (!editing.veiculo_id) { toast.error('Selecione o veículo'); setSaving(false); return }
      if (!editing.value) { toast.error('Informe o valor'); setSaving(false); return }
      const ve = veiculos.find(x=>x.id===editing.veiculo_id)
      const fo = fornecedores.find(x=>x.id===editing.supplier_id)
      const obj = {
        expense_date: editing.expense_date||td(),
        veiculo_id: editing.veiculo_id, veiculo_placa: ve?.placa||null,
        category: editing.category||'Outros', description: editing.description||null,
        value: parseFloat(editing.value),
        supplier_id: editing.supplier_id||null, supplier_name: fo?.nome_razao||null,
        km: editing.km ? parseFloat(editing.km) : null,
        notes: editing.notes||null, created_by: profile?.display_name||'',
      }
      const res = editing.id
        ? await supabase.from('vehicle_expenses').update(obj).eq('id',editing.id)
        : await supabase.from('vehicle_expenses').insert({...obj, company_id: profile?.company_id||null})
      error = res.error
    }

    if (error) { toast.error('Erro: '+error.message); setSaving(false); return }
    toast.success(editing.id ? 'Atualizado ✅' : 'Registrado ✅')
    setSaving(false); setModal(false); loadAll()
  }

  async function del(id: string, tbl: string) {
    if (!await confirm('Excluir este registro?')) return
    const { error } = await supabase.from(tbl).delete().eq('id',id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Excluído'); loadAll()
  }

  // ── Relatório filtrado ──
  const repRecs = records.filter(r =>
    (!rFrom || r.record_date >= rFrom) && (!rTo || r.record_date <= rTo) &&
    (!rVeic || r.veiculo_id === rVeic))
  const repExps = expenses.filter(x =>
    (!rFrom || x.expense_date >= rFrom) && (!rTo || x.expense_date <= rTo) &&
    (!rVeic || x.veiculo_id === rVeic))
  const repLiters = repRecs.reduce((s,r)=>s+(parseFloat(r.liters)||0),0)
  const repFuelVal = repRecs.reduce((s,r)=>s+(parseFloat(r.total_value)||0),0)
  const repExpVal = repExps.reduce((s,x)=>s+(parseFloat(x.value)||0),0)

  // agrupa por veículo
  const byVeic: Record<string, {placa:string; liters:number; fuel:number; exp:number}> = {}
  repRecs.forEach(r => {
    const k = r.veiculo_placa || r.machine_name || '—'
    if (!byVeic[k]) byVeic[k] = {placa:k, liters:0, fuel:0, exp:0}
    byVeic[k].liters += parseFloat(r.liters)||0
    byVeic[k].fuel   += parseFloat(r.total_value)||0
  })
  repExps.forEach(x => {
    const k = x.veiculo_placa || '—'
    if (!byVeic[k]) byVeic[k] = {placa:k, liters:0, fuel:0, exp:0}
    byVeic[k].exp += parseFloat(x.value)||0
  })
  const veicRows = Object.values(byVeic).sort((a,b)=>(b.fuel+b.exp)-(a.fuel+a.exp))

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      const now = new Date()
      doc.setFillColor(6,13,26); doc.rect(0,0,210,25,'F')
      doc.setTextColor(249,115,22); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('Industrial8 — Relatório de Combustível', 12, 11)
      doc.setTextColor(148,163,184); doc.setFontSize(8); doc.setFont('helvetica','normal')
      let fi = ''
      if (rFrom||rTo) fi += `Período: ${rFrom?fmtD(rFrom):'início'} a ${rTo?fmtD(rTo):'hoje'} | `
      if (rVeic) fi += `Veículo: ${veiculos.find(v=>v.id===rVeic)?.placa||''}`
      doc.text(fi || `Gerado em ${now.toLocaleDateString('pt-BR')}`, 12, 18)

      autoTable(doc, {
        startY: 30, head: [['Veículo/Máquina','Litros','Custo Combustível','Outras Despesas','Total']],
        body: veicRows.map(v => [v.placa, v.liters.toFixed(2)+' L', money(v.fuel), money(v.exp), money(v.fuel+v.exp)]),
        foot: [['TOTAL', repLiters.toFixed(2)+' L', money(repFuelVal), money(repExpVal), money(repFuelVal+repExpVal)]],
        theme:'grid', headStyles:{fillColor:[249,115,22]}, footStyles:{fillColor:[30,58,110]}, styles:{fontSize:8},
      })

      const y = (doc as any).lastAutoTable.finalY + 8
      autoTable(doc, {
        startY: y, head: [['Data','Veículo/Máquina','KM','Horímetro','Litros','Valor','Motorista']],
        body: repRecs.map(r => [fmtD(r.record_date), r.veiculo_placa||r.machine_name||'—',
          r.km||'—', r.hour_meter||'—', (parseFloat(r.liters)||0).toFixed(2), money(r.total_value), r.driver_name||'—']),
        theme:'striped', headStyles:{fillColor:[30,58,110]}, styles:{fontSize:7},
      })
      doc.save(`combustivel_${td()}.pdf`)
      toast.success('PDF gerado ✅')
    } catch(e:any) { toast.error('Erro ao gerar PDF: '+e.message) }
  }

  const TABS: [Tab,string][] = [['abast','⛽ Abastec.'],['entradas','📥 Entradas'],['despesas','🔧 Despesas'],['relatorio','📊 Relatório']]

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="⛽ Combustível" action={
        tab!=='relatorio' ? <Btn onClick={openNew} variant="primary" size="sm">+ Novo</Btn>
                          : <Btn onClick={exportPDF} variant="primary" size="sm">📄 PDF</Btn>
      } />

      {/* KPIs de estoque */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KPI num={`${stock.toFixed(0)} L`} label="Estoque atual" color={stock<500?'red':'green'} />
        <KPI num={`${totalOut.toFixed(0)} L`} label="Total consumido" color="amber" />
        <KPI num={money(avgPrice)} label="Preço médio/L" color="orange" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {TABS.map(([t,l]) => (
          <div key={t} onClick={()=>setTab(t)}
            style={{ flexShrink:0, padding:'7px 12px', borderRadius:'10px', fontSize:'11px', fontWeight:700, cursor:'pointer',
              background: tab===t?'rgba(249,115,22,.12)':'var(--s1)',
              border:`1px solid ${tab===t?'rgba(249,115,22,.4)':'var(--bd)'}`,
              color: tab===t?'#f97316':'var(--t2)', whiteSpace:'nowrap' }}>{l}</div>
        ))}
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> : <>

        {/* ═══ ABASTECIMENTOS ═══ */}
        {tab==='abast' && (records.length===0 ? <Empty icon="⛽" text="Nenhum abastecimento registrado." /> : (
          <div className="flex flex-col gap-2">
            {records.map(r => (
              <div key={r.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" style={{color:'var(--cy)'}}>{(parseFloat(r.liters)||0).toFixed(2)} L</span>
                      {r.total_value && <Badge color="orange">{money(r.total_value)}</Badge>}
                    </div>
                    <div className="font-bold text-xs">{r.veiculo_placa || r.machine_name || '—'}</div>
                    <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>
                      📅 {fmtD(r.record_date)}{r.record_time?' às '+r.record_time.slice(0,5):''}
                      {r.driver_name?' · 🚗 '+r.driver_name:''}
                    </div>
                    <div className="text-xs" style={{color:'var(--t3)'}}>
                      {r.km ? `🛣 ${r.km} km` : ''}{r.km&&r.hour_meter?' · ':''}{r.hour_meter ? `⏱ ${r.hour_meter} h` : ''}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Btn onClick={()=>{setEditing(r);setModal(true)}} size="sm">✏️</Btn>
                    <Btn onClick={()=>del(r.id,'fuel_records')} variant="danger" size="sm">🗑</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* ═══ ENTRADAS ═══ */}
        {tab==='entradas' && (entries.length===0 ? <Empty icon="📥" text="Nenhuma compra de combustível." /> : (
          <div className="flex flex-col gap-2">
            {entries.map(e => (
              <div key={e.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" style={{color:'var(--gn)'}}>+{(parseFloat(e.liters)||0).toFixed(2)} L</span>
                      <Badge color="orange">{money(e.total_value)}</Badge>
                      {e.unit_price && <span className="text-xs" style={{color:'var(--t3)'}}>{money(e.unit_price)}/L</span>}
                    </div>
                    <div className="text-xs" style={{color:'var(--t2)'}}>
                      📅 {fmtD(e.entry_date)}{e.supplier_name?' · 🏭 '+e.supplier_name:''}
                    </div>
                    {e.invoice && <div className="text-xs" style={{color:'var(--t3)'}}>📄 NF {e.invoice}</div>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Btn onClick={()=>{setEditing(e);setModal(true)}} size="sm">✏️</Btn>
                    <Btn onClick={()=>del(e.id,'fuel_entries')} variant="danger" size="sm">🗑</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* ═══ DESPESAS ═══ */}
        {tab==='despesas' && (expenses.length===0 ? <Empty icon="🔧" text="Nenhuma despesa registrada." /> : (
          <div className="flex flex-col gap-2">
            {expenses.map(x => (
              <div key={x.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge color="purple">{x.category}</Badge>
                      <span className="font-bold text-sm" style={{color:'var(--cy)'}}>{money(x.value)}</span>
                    </div>
                    <div className="font-bold text-xs">{x.veiculo_placa||'—'}</div>
                    {x.description && <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>{x.description}</div>}
                    <div className="text-xs" style={{color:'var(--t3)'}}>
                      📅 {fmtD(x.expense_date)}{x.supplier_name?' · 🏭 '+x.supplier_name:''}{x.km?' · 🛣 '+x.km+' km':''}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Btn onClick={()=>{setEditing(x);setModal(true)}} size="sm">✏️</Btn>
                    <Btn onClick={()=>del(x.id,'vehicle_expenses')} variant="danger" size="sm">🗑</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* ═══ RELATÓRIO ═══ */}
        {tab==='relatorio' && (
          <>
            <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div style={{fontSize:'9px',fontWeight:700,color:'rgba(249,115,22,.65)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>FILTROS</div>
              <div className="grid grid-cols-2 gap-x-3">
                <Input label="De" value={rFrom} onChange={setRFrom} type="date" />
                <Input label="Até" value={rTo} onChange={setRTo} type="date" />
              </div>
              <Select label="Veículo" value={rVeic} onChange={setRVeic}
                options={[{value:'',label:'Todos os veículos'}, ...veiculos.map(v=>({value:v.id,label:`${v.placa} (${v.tipo})`}))]} />
              {(rFrom||rTo||rVeic) && <Btn onClick={()=>{setRFrom('');setRTo('');setRVeic('')}} size="sm" variant="secondary">✕ Limpar filtros</Btn>}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <KPI num={`${repLiters.toFixed(0)} L`} label="Litros" color="blue" />
              <KPI num={money(repFuelVal)} label="Combustível" color="orange" />
              <KPI num={money(repExpVal)} label="Outras desp." color="purple" />
            </div>

            {veicRows.length===0 ? <Empty icon="📊" text="Nenhum dado no período." /> : (
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 60px 80px 80px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Veículo</span><span style={{textAlign:'right'}}>Litros</span><span style={{textAlign:'right'}}>Comb.</span><span style={{textAlign:'right'}}>Desp.</span>
                </div>
                {veicRows.map((v,i) => (
                  <div key={i} className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 60px 80px 80px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'11px'}}>
                    <span style={{fontWeight:700}}>{v.placa}</span>
                    <span style={{textAlign:'right',color:'var(--t2)'}}>{v.liters.toFixed(1)}</span>
                    <span style={{textAlign:'right',color:'var(--cy)'}}>{money(v.fuel).replace('R$ ','')}</span>
                    <span style={{textAlign:'right',color:'var(--pp)'}}>{money(v.exp).replace('R$ ','')}</span>
                  </div>
                ))}
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 60px 80px 80px',background:'rgba(249,115,22,.1)',borderTop:'2px solid rgba(249,115,22,.3)',fontSize:'11px',fontWeight:700}}>
                  <span>TOTAL</span>
                  <span style={{textAlign:'right'}}>{repLiters.toFixed(1)}</span>
                  <span style={{textAlign:'right',color:'var(--cy)'}}>{money(repFuelVal).replace('R$ ','')}</span>
                  <span style={{textAlign:'right',color:'var(--pp)'}}>{money(repExpVal).replace('R$ ','')}</span>
                </div>
              </div>
            )}
          </>
        )}
      </>}

      {/* ═══ MODAL ═══ */}
      <Modal open={modal} onClose={()=>setModal(false)}
        title={tab==='abast'?(editing.id?'Editar Abastecimento':'Novo Abastecimento')
              :tab==='entradas'?(editing.id?'Editar Entrada':'Nova Entrada de Combustível')
              :(editing.id?'Editar Despesa':'Nova Despesa de Veículo')}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn>
                <Btn onClick={save} variant="primary" size="md" disabled={saving}>{saving?'Salvando...':'Salvar'}</Btn></>}>

        {tab==='abast' && <>
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Data *" value={editing.record_date} onChange={(v:string)=>setEditing((e:any)=>({...e,record_date:v}))} type="date" />
            <Input label="Hora" value={editing.record_time} onChange={(v:string)=>setEditing((e:any)=>({...e,record_time:v}))} type="time" />
          </div>
          <Select label="Veículo" value={editing.veiculo_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,veiculo_id:v,machine_id:''}))}
            options={[{value:'',label:'Nenhum (é máquina)'}, ...veiculos.map(v=>({value:v.id,label:`${v.placa} (${v.tipo})`}))]} />
          <Select label="Máquina" value={editing.machine_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,machine_id:v,veiculo_id:''}))}
            options={[{value:'',label:'Nenhuma (é veículo)'}, ...machines.map(m=>({value:m.id,label:`${m.icon||'⚙️'} ${m.name}`}))]} />
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="KM (veículos)" value={editing.km} onChange={(v:string)=>setEditing((e:any)=>({...e,km:v}))} type="number" placeholder="0" />
            <Input label="Horímetro (máquinas)" value={editing.hour_meter} onChange={(v:string)=>setEditing((e:any)=>({...e,hour_meter:v}))} type="number" placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Litros *" value={editing.liters} onChange={(v:string)=>setEditing((e:any)=>({...e,liters:v}))} type="number" placeholder="0.00" />
            <Input label={`Preço/L (médio: ${money(avgPrice)})`} value={editing.unit_price} onChange={(v:string)=>setEditing((e:any)=>({...e,unit_price:v}))} type="number" placeholder={avgPrice.toFixed(4)} />
          </div>
          <Select label="Motorista/Operador" value={editing.driver_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,driver_id:v}))}
            options={[{value:'',label:'Nenhum'}, ...motoristas.map(m=>({value:m.id,label:m.nome_razao}))]} />
          <Textarea label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} rows={2} placeholder="Opcional..." />
        </>}

        {tab==='entradas' && <>
          <Input label="Data *" value={editing.entry_date} onChange={(v:string)=>setEditing((e:any)=>({...e,entry_date:v}))} type="date" />
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Litros *" value={editing.liters} onChange={(v:string)=>setEditing((e:any)=>({...e,liters:v}))} type="number" placeholder="0.00" />
            <Input label="Valor Total R$ *" value={editing.total_value} onChange={(v:string)=>setEditing((e:any)=>({...e,total_value:v}))} type="number" placeholder="0.00" />
          </div>
          {editing.liters&&editing.total_value&&parseFloat(editing.liters)>0 && (
            <div style={{fontSize:'11px',color:'var(--cy)',fontWeight:700,marginBottom:'8px'}}>
              💧 Preço unitário: {money(parseFloat(editing.total_value)/parseFloat(editing.liters))}/L
            </div>
          )}
          <Select label="Fornecedor" value={editing.supplier_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,supplier_id:v}))}
            options={[{value:'',label:'Nenhum'}, ...fornecedores.map(f=>({value:f.id,label:f.nome_razao}))]} />
          <Input label="Nota Fiscal" value={editing.invoice} onChange={(v:string)=>setEditing((e:any)=>({...e,invoice:v}))} placeholder="Nº da NF" />
          <Textarea label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} rows={2} placeholder="Opcional..." />
        </>}

        {tab==='despesas' && <>
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Data *" value={editing.expense_date} onChange={(v:string)=>setEditing((e:any)=>({...e,expense_date:v}))} type="date" />
            <Select label="Categoria" value={editing.category||'Manutenção'} onChange={(v:string)=>setEditing((e:any)=>({...e,category:v}))} options={EXP_CATS} />
          </div>
          <Select label="Veículo *" value={editing.veiculo_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,veiculo_id:v}))}
            options={[{value:'',label:'Selecione...'}, ...veiculos.map(v=>({value:v.id,label:`${v.placa} (${v.tipo})`}))]} />
          <Input label="Descrição" value={editing.description} onChange={(v:string)=>setEditing((e:any)=>({...e,description:v}))} placeholder="Ex: Troca de pneus dianteiros" />
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Valor R$ *" value={editing.value} onChange={(v:string)=>setEditing((e:any)=>({...e,value:v}))} type="number" placeholder="0.00" />
            <Input label="KM na data" value={editing.km} onChange={(v:string)=>setEditing((e:any)=>({...e,km:v}))} type="number" placeholder="0" />
          </div>
          <Select label="Fornecedor/Oficina" value={editing.supplier_id||''} onChange={(v:string)=>setEditing((e:any)=>({...e,supplier_id:v}))}
            options={[{value:'',label:'Nenhum'}, ...fornecedores.map(f=>({value:f.id,label:f.nome_razao}))]} />
          <Textarea label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} rows={2} placeholder="Opcional..." />
        </>}
      </Modal>
    </div>
  )
}
