'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const WOOD_CLASSES = ['12 a 18', '18 a 24', '24 a 35']

function maskPlate(v: string) {
  v = v.toUpperCase().replace(/[^A-Z0-9]/g,'')
  if (v.length > 7) v = v.slice(0,7)
  return v
}

export default function WoodPage({ profile, can }: Props) {
  const [entries, setEntries] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [veiculos, setVeiculos] = useState<any[]>([])
  const [precos, setPrecos] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [view, setView] = useState<any>(null)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'lista'|'relatorio'>('lista')
  const [rFrom, setRFrom] = useState(''); const [rTo, setRTo] = useState('')
  const [rForn, setRForn] = useState('')
  const [rMot, setRMot] = useState('')
  const [rClasse, setRClasse] = useState('')
  const [rVeic, setRVeic] = useState('')
  const [rView, setRView] = useState<'forn'|'mot'|'veic'|'classe'>('forn')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); loadSuppliers() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('wood_entries').select('*')
      .order('data_entrada', { ascending: false })
      .order('unload_time', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) toast.error('Erro ao carregar: ' + error.message)
    setEntries(data || [])
    setLoading(false)
  }

  async function loadSuppliers() {
    const [forn, mots, veic, prc] = await Promise.all([
      supabase.from('cadastros').select('id,nome_razao').eq('is_fornecedor', true).eq('status', true).order('nome_razao'),
      supabase.from('cadastros').select('id,nome_razao').eq('is_motorista', true).eq('status', true).order('nome_razao'),
      supabase.from('veiculos').select('id,placa,tipo').eq('status', true).order('placa'),
      supabase.from('supplier_prices').select('supplier_name,price_ton').eq('active', true).eq('product','Pinus'),
    ])
    setPrecos(prc.data || [])
    setSuppliers((forn.data||[]).map((x:any)=>({id:x.id,name:x.nome_razao})))
    setMotoristas((mots.data||[]).map((x:any)=>({id:x.id,name:x.nome_razao})))
    setVeiculos(veic.data||[])
  }

  function precoDe(nomeForn: string) {
    const p = precos.find(x => (x.supplier_name||'').toLowerCase() === (nomeForn||'').toLowerCase())
    return p ? parseFloat(p.price_ton) : 0
  }

  function openNew() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2,'0')
    const mm = String(now.getMinutes()).padStart(2,'0')
    setEditing({
      data_entrada: td(),
      arrival_time: `${hh}:${mm}`,
      wood_class: '18 a 24',
    })
    setModal(true)
  }

  async function save() {
    if (!editing.supplier_id)    { toast.error('Selecione o fornecedor'); return }
    if (!editing.wood_class)     { toast.error('Selecione a classe da madeira'); return }
    if (!editing.driver?.trim()) { toast.error('Informe o motorista'); return }
    if (!editing.plate?.trim())  { toast.error('Informe a placa'); return }
    if (!editing.weight_tons || parseFloat(editing.weight_tons) <= 0) { toast.error('Informe o peso em toneladas'); return }

    setSaving(true)

    const sup = suppliers.find(s => s.id === editing.supplier_id)
    const mot = editing.driver_id ? motoristas.find(m => m.id === editing.driver_id) : null
    const obj = {
      data_entrada:  editing.data_entrada || td(),
      arrival_time:  editing.arrival_time,
      unload_time:   editing.unload_time || null,
      veiculo_id:    editing.veiculo_id || null,
      supplier_id:   editing.supplier_id,
      supplier_name: sup?.name || '',
      wood_class:    editing.wood_class,
      driver:        editing.driver.trim(),
      plate:         editing.plate.trim().toUpperCase(),
      weight_tons:   parseFloat(editing.weight_tons),
      volume_m3:     editing.volume_m3 ? parseFloat(editing.volume_m3) : null,
      unit_value:    editing.unit_value ? parseFloat(editing.unit_value) : (precoDe(sup?.name||'') || null),
      total_value:   editing.total_value ? parseFloat(editing.total_value)
                     : (precoDe(sup?.name||'') * (parseFloat(editing.weight_tons)||0)) || null,
      observation:   editing.observation || null,
      created_by:    profile?.display_name || profile?.email || '',
      created_by_id: profile?.id || null,
    }

    const { error } = editing.id
      ? await supabase.from('wood_entries').update({ ...obj, updated_by: profile?.display_name, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('wood_entries').insert(obj)

    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }

    // Audit trail
    await supabase.from('audit_trail').insert({
      table_name: 'wood_entries',
      record_id: editing.id || null,
      action: editing.id ? 'UPDATE' : 'INSERT',
      new_data: obj,
      user_id: profile?.id,
      user_name: profile?.display_name,
    }).then(() => {})

    toast.success(editing.id ? 'Registro atualizado ✅' : 'Entrada registrada ✅')
    setSaving(false)
    setModal(false)
    load()
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta entrada?')) return
    const { error } = await supabase.from('wood_entries').delete().eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Excluído')
    load()
  }

  // ── Relatório ──
  const rep = entries.filter(e =>
    (!rFrom || (e.data_entrada||'') >= rFrom) &&
    (!rTo   || (e.data_entrada||'') <= rTo) &&
    (!rForn || e.supplier_id === rForn) &&
    (!rMot  || e.driver_id === rMot || (e.driver||'') === rMot) &&
    (!rClasse || e.wood_class === rClasse) &&
    (!rVeic || e.veiculo_id === rVeic || (e.plate||'') === rVeic))
  const repTons = rep.reduce((s,e)=>s+(parseFloat(e.weight_tons)||0),0)
  const repM3   = rep.reduce((s,e)=>s+(parseFloat(e.volume_m3)||0),0)
  const repVal  = rep.reduce((s,e)=>s+(parseFloat(e.total_value)||0),0)
  const byForn: Record<string,{nome:string;tons:number;m3:number;cargas:number;val:number}> = {}
  rep.forEach(e => {
    const k = e.supplier_name || '—'
    if (!byForn[k]) byForn[k] = {nome:k, tons:0, m3:0, cargas:0, val:0}
    byForn[k].tons += parseFloat(e.weight_tons)||0
    byForn[k].m3   += parseFloat(e.volume_m3)||0
    byForn[k].val  += parseFloat(e.total_value)||0
    byForn[k].cargas += 1
  })
  const fornRows = Object.values(byForn).sort((a,b)=>b.tons-a.tons)

  // Agrupa por qualquer chave (motorista, veículo, classe)
  function agrupar(keyFn: (e:any)=>string) {
    const m: Record<string,{nome:string;tons:number;m3:number;cargas:number;val:number}> = {}
    rep.forEach(e => {
      const k = keyFn(e) || '—'
      if (!m[k]) m[k] = {nome:k, tons:0, m3:0, cargas:0, val:0}
      m[k].tons   += parseFloat(e.weight_tons)||0
      m[k].m3     += parseFloat(e.volume_m3)||0
      m[k].val    += parseFloat(e.total_value)||0
      m[k].cargas += 1
    })
    return Object.values(m).sort((a,b)=>b.tons-a.tons)
  }
  const motRows    = agrupar(e => e.driver)
  const veicRows   = agrupar(e => e.plate)
  const classeRows = agrupar(e => e.wood_class)

  // Cruzamento motorista x fornecedor (viagens por rota)
  const rotaRows = (() => {
    const m: Record<string,{mot:string;forn:string;cargas:number;tons:number;val:number}> = {}
    rep.forEach(e => {
      const mo = e.driver || '—', fo = e.supplier_name || '—'
      const k = mo + '||' + fo
      if (!m[k]) m[k] = {mot:mo, forn:fo, cargas:0, tons:0, val:0}
      m[k].cargas += 1
      m[k].tons   += parseFloat(e.weight_tons)||0
      m[k].val    += parseFloat(e.total_value)||0
    })
    return Object.values(m).sort((a,b)=>b.tons-a.tons)
  })()

  const viewRows = rView==='mot' ? motRows : rView==='veic' ? veicRows : rView==='classe' ? classeRows : fornRows
  const viewLabel = rView==='mot' ? 'Motorista' : rView==='veic' ? 'Placa' : rView==='classe' ? 'Classe' : 'Fornecedor'

  // média por carga
  const mediaCarga = rep.length > 0 ? repTons / rep.length : 0

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      const money = (v:number) => (v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

      doc.setFillColor(6,13,26); doc.rect(0,0,210,26,'F')
      doc.setTextColor(249,115,22); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('Industrial8 — Relatório de Entrada de Madeira', 12, 11)
      doc.setTextColor(148,163,184); doc.setFontSize(7); doc.setFont('helvetica','normal')

      const fs: string[] = []
      if (rFrom || rTo) fs.push(`Período: ${rFrom?fmtD(rFrom):'início'} a ${rTo?fmtD(rTo):'hoje'}`)
      if (rForn)   fs.push(`Fornecedor: ${suppliers.find(s=>s.id===rForn)?.name||''}`)
      if (rMot)    fs.push(`Motorista: ${rMot}`)
      if (rClasse) fs.push(`Classe: ${rClasse}`)
      if (rVeic)   fs.push(`Placa: ${rVeic}`)
      doc.text(fs.length ? fs.join('  |  ') : 'Todos os registros', 12, 17)
      doc.text(`${rep.length} viagens · ${repTons.toFixed(2)} t · ${repM3.toFixed(2)} m³ · R$ ${money(repVal)} · média ${mediaCarga.toFixed(2)} t/viagem`, 12, 22)

      // 1) Por fornecedor
      autoTable(doc, {
        startY: 31,
        head: [['Fornecedor','Viagens','Toneladas','m³','Média t/viagem','Valor R$']],
        body: fornRows.map(f=>[f.nome, String(f.cargas), f.tons.toFixed(3), f.m3.toFixed(2),
          (f.tons/f.cargas).toFixed(2), money(f.val)]),
        foot: [['TOTAL', String(rep.length), repTons.toFixed(3), repM3.toFixed(2),
          mediaCarga.toFixed(2), money(repVal)]],
        theme:'grid', headStyles:{fillColor:[249,115,22]}, footStyles:{fillColor:[30,58,110]}, styles:{fontSize:8},
      })

      // 2) Por motorista
      let y = (doc as any).lastAutoTable.finalY + 7
      autoTable(doc, {
        startY: y,
        head: [['Motorista','Viagens','Toneladas','m³','Média t/viagem']],
        body: motRows.map(f=>[f.nome, String(f.cargas), f.tons.toFixed(3), f.m3.toFixed(2), (f.tons/f.cargas).toFixed(2)]),
        foot: [['TOTAL', String(rep.length), repTons.toFixed(3), repM3.toFixed(2), mediaCarga.toFixed(2)]],
        theme:'grid', headStyles:{fillColor:[34,197,94]}, footStyles:{fillColor:[30,58,110]}, styles:{fontSize:8},
      })

      // 3) Viagens por rota
      y = (doc as any).lastAutoTable.finalY + 7
      autoTable(doc, {
        startY: y,
        head: [['Motorista','Fornecedor','Viagens','Toneladas','Média t/viagem']],
        body: rotaRows.map(r=>[r.mot, r.forn, String(r.cargas), r.tons.toFixed(3), (r.tons/r.cargas).toFixed(2)]),
        theme:'striped', headStyles:{fillColor:[59,130,246]}, styles:{fontSize:7},
      })

      // 4) Por placa e classe
      y = (doc as any).lastAutoTable.finalY + 7
      autoTable(doc, {
        startY: y,
        head: [['Placa','Viagens','Toneladas','Média t/viagem']],
        body: veicRows.map(f=>[f.nome, String(f.cargas), f.tons.toFixed(3), (f.tons/f.cargas).toFixed(2)]),
        theme:'grid', headStyles:{fillColor:[168,85,247]}, styles:{fontSize:7},
      })

      y = (doc as any).lastAutoTable.finalY + 7
      autoTable(doc, {
        startY: y,
        head: [['Classe da madeira','Viagens','Toneladas','m³','Valor R$']],
        body: classeRows.map(f=>[f.nome, String(f.cargas), f.tons.toFixed(3), f.m3.toFixed(2), money(f.val)]),
        theme:'grid', headStyles:{fillColor:[245,158,11]}, styles:{fontSize:7},
      })

      // 5) Detalhado
      doc.addPage()
      autoTable(doc, {
        startY: 14,
        head: [['Data','Descarga','Fornecedor','Classe','Motorista','Placa','Ton','R$/t','Valor']],
        body: rep.map(e=>[
          fmtD(e.data_entrada),
          e.unload_time?.slice(0,5) || e.arrival_time?.slice(0,5) || '—',
          e.supplier_name||'—', e.wood_class||'—', e.driver||'—', e.plate||'—',
          (parseFloat(e.weight_tons)||0).toFixed(2),
          e.unit_value ? parseFloat(e.unit_value).toFixed(2) : '—',
          e.total_value ? money(parseFloat(e.total_value)) : '—',
        ]),
        foot: [['','','','','','TOTAL', repTons.toFixed(2), '', money(repVal)]],
        theme:'striped', headStyles:{fillColor:[30,58,110]}, footStyles:{fillColor:[249,115,22]}, styles:{fontSize:6.5},
      })

      doc.save(`madeira_${td()}.pdf`)
      toast.success('PDF gerado ✅')
    } catch(err:any) { toast.error('Erro ao gerar PDF: '+err.message) }
  }

  const totalTons = entries.slice(0, 30).reduce((s, e) => s + (parseFloat(e.weight_tons) || 0), 0)
  const totalEntries = entries.filter(e => e.data_entrada === td()).length

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="🪵 Entrada de Madeira" action={
        tab==='lista' ? <Btn onClick={openNew} variant="primary" size="sm">+ Entrada</Btn>
                      : <Btn onClick={exportPDF} variant="primary" size="sm">📄 PDF</Btn>
      } />

      <div className="flex gap-2 mb-3">
        {([['lista','📋 Lançamentos'],['relatorio','📊 Relatório']] as ['lista'|'relatorio',string][]).map(([t,l]) => (
          <div key={t} onClick={()=>setTab(t)}
            style={{ flex:1, textAlign:'center', padding:'8px', borderRadius:'10px', fontSize:'12px', fontWeight:700, cursor:'pointer',
              background: tab===t?'rgba(249,115,22,.12)':'var(--s1)',
              border:`1px solid ${tab===t?'rgba(249,115,22,.4)':'var(--bd)'}`,
              color: tab===t?'#f97316':'var(--t2)' }}>{l}</div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <KPI num={`${totalTons.toFixed(1)} t`} label="Toneladas (30 últ.)" color="green" />
        <KPI num={totalEntries} label="Entradas hoje" color="orange" />
      </div>

      {tab==='relatorio' && (
        <>
          {/* ═══ FILTROS ═══ */}
          <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div style={{fontSize:'9px',fontWeight:700,color:'rgba(249,115,22,.65)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>FILTROS</div>
            <div className="grid grid-cols-2 gap-x-3">
              <Input label="De" value={rFrom} onChange={setRFrom} type="date" />
              <Input label="Até" value={rTo} onChange={setRTo} type="date" />
            </div>
            <Select label="Fornecedor" value={rForn} onChange={setRForn}
              options={[{value:'',label:'Todos os fornecedores'}, ...suppliers.map(s=>({value:s.id,label:s.name}))]} />
            <Select label="Motorista" value={rMot} onChange={setRMot}
              options={[{value:'',label:'Todos os motoristas'},
                ...Array.from(new Set(entries.map(e=>e.driver).filter(Boolean))).sort().map(d=>({value:d,label:d}))]} />
            <div className="grid grid-cols-2 gap-x-3">
              <Select label="Classe" value={rClasse} onChange={setRClasse}
                options={[{value:'',label:'Todas'}, ...WOOD_CLASSES.map(x=>({value:x,label:x}))]} />
              <Select label="Placa" value={rVeic} onChange={setRVeic}
                options={[{value:'',label:'Todas'},
                  ...Array.from(new Set(entries.map(e=>e.plate).filter(Boolean))).sort().map(x=>({value:x,label:x}))]} />
            </div>
            {(rFrom||rTo||rForn||rMot||rClasse||rVeic) && (
              <Btn onClick={()=>{setRFrom('');setRTo('');setRForn('');setRMot('');setRClasse('');setRVeic('')}} size="sm" variant="secondary">✕ Limpar filtros</Btn>
            )}
          </div>

          {/* ═══ KPIs ═══ */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <KPI num={rep.length} label="Viagens" color="blue" />
            <KPI num={`${repTons.toFixed(1)}t`} label="Toneladas" color="green" />
            <KPI num={`${mediaCarga.toFixed(2)}t`} label="Média/carga" color="amber" />
            <KPI num={`R$${(repVal/1000).toFixed(0)}k`} label="Valor" color="purple" />
          </div>

          <div className="rounded-xl px-3 py-2 mb-3 flex items-center justify-center gap-3"
            style={{background:'var(--s1)',border:'1px solid var(--bd)',fontSize:'10px'}}>
            <span style={{color:'var(--t3)'}}>📦 {repM3.toFixed(1)} m³</span>
            <span style={{color:'var(--t3)'}}>·</span>
            <span style={{color:'var(--t3)'}}>🚗 {new Set(rep.map(e=>e.driver).filter(Boolean)).size} motorista(s)</span>
            <span style={{color:'var(--t3)'}}>·</span>
            <span style={{color:'var(--t3)'}}>🏭 {new Set(rep.map(e=>e.supplier_name).filter(Boolean)).size} fornecedor(es)</span>
          </div>

          {rep.length===0 ? <Empty icon="📊" text="Nenhum dado no período." /> : (
            <>
              {/* ═══ SELETOR DE AGRUPAMENTO ═══ */}
              <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                {([['forn','🏭 Fornecedor'],['mot','🚗 Motorista'],['veic','🚛 Placa'],['classe','🪵 Classe']] as ['forn'|'mot'|'veic'|'classe',string][]).map(([k,l])=>(
                  <div key={k} onClick={()=>setRView(k)}
                    style={{flexShrink:0,padding:'6px 11px',borderRadius:'16px',fontSize:'10px',fontWeight:700,cursor:'pointer',
                      background:rView===k?'rgba(249,115,22,.14)':'var(--s2)',
                      border:`1px solid ${rView===k?'rgba(249,115,22,.4)':'var(--bd)'}`,
                      color:rView===k?'#f97316':'var(--t3)',whiteSpace:'nowrap'}}>{l}</div>
                ))}
              </div>

              {/* ═══ TABELA AGRUPADA ═══ */}
              <div className="rounded-xl overflow-hidden mb-3" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 44px 56px 48px 76px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>{viewLabel}</span><span style={{textAlign:'right'}}>Viag.</span><span style={{textAlign:'right'}}>Ton</span><span style={{textAlign:'right'}}>m³</span><span style={{textAlign:'right'}}>Valor</span>
                </div>
                {viewRows.map((f,i)=>{
                  const pct = repTons>0 ? f.tons/repTons*100 : 0
                  return (
                    <div key={i} style={{background:'var(--s1)',borderTop:'1px solid var(--bd)'}}>
                      <div className="grid px-3 pt-2" style={{gridTemplateColumns:'1fr 44px 56px 48px 76px',fontSize:'11px'}}>
                        <span style={{fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.nome}</span>
                        <span style={{textAlign:'right',color:'var(--t2)'}}>{f.cargas}</span>
                        <span style={{textAlign:'right',color:'var(--cy)'}}>{f.tons.toFixed(1)}</span>
                        <span style={{textAlign:'right',color:'var(--am)'}}>{f.m3>0?f.m3.toFixed(1):'—'}</span>
                        <span style={{textAlign:'right',color:'#f97316',fontWeight:700}}>{f.val>0?f.val.toLocaleString('pt-BR',{maximumFractionDigits:0}):'—'}</span>
                      </div>
                      <div className="px-3 pb-2 pt-1">
                        <div style={{height:'3px',background:'rgba(255,255,255,.05)',borderRadius:'2px',overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:'linear-gradient(90deg,#f97316,#fb923c)',borderRadius:'2px'}} />
                        </div>
                        <div style={{fontSize:'8px',color:'var(--t3)',marginTop:'2px'}}>
                          {pct.toFixed(1)}% · média {(f.tons/f.cargas).toFixed(2)} t/viagem
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 44px 56px 48px 76px',background:'rgba(249,115,22,.1)',borderTop:'2px solid rgba(249,115,22,.3)',fontSize:'11px',fontWeight:800}}>
                  <span>TOTAL</span>
                  <span style={{textAlign:'right'}}>{rep.length}</span>
                  <span style={{textAlign:'right',color:'var(--cy)'}}>{repTons.toFixed(1)}</span>
                  <span style={{textAlign:'right',color:'var(--am)'}}>{repM3.toFixed(1)}</span>
                  <span style={{textAlign:'right',color:'#f97316'}}>{repVal.toLocaleString('pt-BR',{maximumFractionDigits:0})}</span>
                </div>
              </div>

              {/* ═══ VIAGENS POR ROTA (motorista x fornecedor) ═══ */}
              <div style={{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'6px'}}>
                🛣 Viagens por rota — motorista × fornecedor
              </div>
              <div className="rounded-xl overflow-hidden mb-3" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 1fr 40px 56px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Motorista</span><span>Fornecedor</span><span style={{textAlign:'right'}}>Viag.</span><span style={{textAlign:'right'}}>Ton</span>
                </div>
                {rotaRows.map((r,i)=>(
                  <div key={i} className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 1fr 40px 56px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'10px'}}>
                    <span style={{fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.mot}</span>
                    <span style={{color:'var(--t2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.forn}</span>
                    <span style={{textAlign:'right',color:'var(--t2)'}}>{r.cargas}</span>
                    <span style={{textAlign:'right',color:'var(--cy)',fontWeight:700}}>{r.tons.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab==='lista' && (loading ? <Empty icon="⏳" text="Carregando..." /> :
       entries.length === 0 ? <Empty icon="🪵" text="Nenhuma entrada registrada." /> : (
        <div className="flex flex-col gap-2">
          {entries.map(e => (
            <div key={e.id} onClick={() => setView(e)}
              className="rounded-xl p-3 cursor-pointer"
              style={{ background: 'var(--s1)', border: '1px solid var(--bd)' }}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="green">{e.wood_class || '—'}</Badge>
                    <span className="text-xs font-bold" style={{ color: 'var(--cy)' }}>
                      {parseFloat(e.weight_tons || 0).toFixed(3)} t
                    </span>
                    {e.volume_m3 > 0 && <span className="text-xs" style={{ color: 'var(--t3)' }}>{parseFloat(e.volume_m3).toFixed(2)} m³</span>}
                    {e.total_value > 0 && <span className="text-xs font-bold" style={{ color: '#f97316' }}>R$ {parseFloat(e.total_value).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                  </div>
                  <div className="font-bold text-sm">{e.supplier_name || '—'}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--t2)' }}>
                    📅 {fmtD(e.data_entrada)}{e.arrival_time ? ' às ' + e.arrival_time.slice(0,5) : ''}
                    {e.driver ? ' · 🚗 ' + e.driver : ''}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--t3)' }}>
                    🚛 {e.plate || '—'}{e.observation ? ' · ' + e.observation : ''}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Btn onClick={ev => { ev.stopPropagation(); setEditing(e); setModal(true) }} size="sm">✏️</Btn>
                  <Btn onClick={ev => { ev.stopPropagation(); del(e.id) }} variant="danger" size="sm">🗑</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Detalhe */}
      <Modal open={!!view} onClose={() => setView(null)} title="Detalhe da Entrada">
        {view && (
          <div className="flex flex-col gap-2">
            {[
              ['Data', fmtD(view.data_entrada)],
              ['Hora Chegada', view.arrival_time?.slice(0,5) || '—'],
              ['Hora Descarga', view.unload_time?.slice(0,5) || '—'],
              ['Fornecedor', view.supplier_name || '—'],
              ['Classe Madeira', view.wood_class || '—'],
              ['Motorista', view.driver || '—'],
              ['Placa', view.plate || '—'],
              ['Toneladas', `${parseFloat(view.weight_tons||0).toFixed(3)} t`],
              ['Metros cúbicos', view.volume_m3 ? `${parseFloat(view.volume_m3).toFixed(2)} m³` : '—'],
              ['R$ / tonelada', view.unit_value ? `R$ ${parseFloat(view.unit_value).toFixed(2)}` : '—'],
              ['Valor total', view.total_value ? `R$ ${parseFloat(view.total_value).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '—'],
              ['Observação', view.observation || '—'],
              ['Registrado por', view.created_by || '—'],
            ].map(([l,v],i) => (
              <div key={i} className="flex justify-between py-1.5 border-b" style={{ borderColor:'var(--bd)', fontSize:'12px' }}>
                <span style={{ color:'var(--t3)' }}>{l}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Formulário */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing.id ? 'Editar Entrada' : 'Nova Entrada de Madeira'}
        footer={
          <>
            <Btn onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save} variant="primary" size="md" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Btn>
          </>
        }>

        <Input label="Data *" value={editing.data_entrada} onChange={(v:string) => setEditing((e:any) => ({...e, data_entrada: v}))} type="date" />
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Hora Chegada *" value={editing.arrival_time} onChange={(v:string) => setEditing((e:any) => ({...e, arrival_time: v}))} type="time" />
          <Input label="Hora Descarga" value={editing.unload_time} onChange={(v:string) => setEditing((e:any) => ({...e, unload_time: v}))} type="time" />
        </div>

        <Select label="Fornecedor *" value={editing.supplier_id || ''} onChange={(v:string) => {
            const s = suppliers.find(x => x.id === v)
            const pr = precoDe(s?.name || '')
            setEditing((e:any) => ({
              ...e, supplier_id: v,
              unit_value: pr || e.unit_value,
              total_value: pr && e.weight_tons ? (pr * parseFloat(e.weight_tons)).toFixed(2) : e.total_value,
            }))
          }}
          options={[{value:'',label:'Selecione o fornecedor...'}, ...suppliers.map(s => ({value: s.id, label: s.name + (precoDe(s.name) ? ` — R$ ${precoDe(s.name).toFixed(2)}/t` : '')}))]} />

        <Select label="Classe da Madeira *" value={editing.wood_class || '18 a 24'} onChange={(v:string) => setEditing((e:any) => ({...e, wood_class: v}))}
          options={WOOD_CLASSES} />

        {motoristas.length > 0 ? (
          <Select label="Motorista *" value={editing.driver_id||''} onChange={(v:string) => {
            const m = motoristas.find(x=>x.id===v)
            setEditing((e:any)=>({...e, driver_id:v, driver: m?.name||''}))
          }} options={[{value:'',label:'Selecione o motorista...'}, ...motoristas.map(m=>({value:m.id,label:m.name}))]} />
        ) : (
          <Input label="Motorista *" value={editing.driver} onChange={(v:string) => setEditing((e:any) => ({...e, driver: v}))} placeholder="Nome completo do motorista" />
        )}

        {veiculos.length > 0 ? (
          <Select label="Placa / Veículo *" value={editing.veiculo_id||''} onChange={(v:string) => {
            const ve = veiculos.find(x=>x.id===v)
            setEditing((e:any)=>({...e, veiculo_id:v, plate: ve?.placa||''}))
          }} options={[{value:'',label:'Selecione o veículo...'}, ...veiculos.map(ve=>({value:ve.id,label:`${ve.placa} (${ve.tipo})`}))]} />
        ) : (
          <Input label="Placa *" value={editing.plate} onChange={(v:string) => setEditing((e:any) => ({...e, plate: maskPlate(v)}))} placeholder="AAA0A00 ou AAA0000" />
        )}

        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Toneladas *" value={editing.weight_tons} onChange={(v:string) => {
            const sup = suppliers.find(x => x.id === editing.supplier_id)
            const pr = parseFloat(editing.unit_value) || precoDe(sup?.name || '')
            setEditing((e:any) => ({...e, weight_tons: v, total_value: pr && v ? (pr * parseFloat(v)).toFixed(2) : e.total_value}))
          }} type="number" placeholder="0.000" />
          <Input label="Metros cúbicos" value={editing.volume_m3} onChange={(v:string) => setEditing((e:any) => ({...e, volume_m3: v}))} type="number" placeholder="0.00" />
        </div>

        <div style={{fontSize:'9px',fontWeight:700,color:'rgba(249,115,22,.65)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px',marginTop:'4px'}}>
          💰 VALOR DA CARGA
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="R$ / tonelada" value={editing.unit_value} onChange={(v:string) => {
            const up = parseFloat(v) || 0
            const t = parseFloat(editing.weight_tons) || 0
            setEditing((e:any) => ({...e, unit_value: v, total_value: up && t ? (up * t).toFixed(2) : e.total_value}))
          }} type="number" placeholder="0.00" />
          <Input label="Valor total R$" value={editing.total_value} onChange={(v:string) => setEditing((e:any) => ({...e, total_value: v}))} type="number" placeholder="0.00" />
        </div>

        <Textarea label="Observação (ticket de peso, anotações)" value={editing.observation} onChange={(v:string) => setEditing((e:any) => ({...e, observation: v}))} rows={2} placeholder="Opcional..." />
      </Modal>
    </div>
  )
}
