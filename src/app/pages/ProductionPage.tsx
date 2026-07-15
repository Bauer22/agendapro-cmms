'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
type Tab = 'lancamentos'|'relatorio'

const WOOD_CLASSES = ['12 a 18','18 a 24','24 a 35']
const CONV = 1.4  // m³ ÷ 1,4 = toneladas
const money = (v:number) => `R$ ${(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`

export default function ProductionPage({ profile, can }: Props) {
  const [tab, setTab] = useState<Tab>('lancamentos')
  const [records, setRecords] = useState<any[]>([])
  const [woodEntries, setWoodEntries] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rFrom, setRFrom] = useState(''); const [rTo, setRTo] = useState('')
  const [rClass, setRClass] = useState('')
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [p, w] = await Promise.all([
      supabase.from('production_records').select('*').order('prod_date',{ascending:false}).limit(300),
      supabase.from('wood_entries').select('data_entrada,weight_tons,peso_liquido,total_value,unit_value,volume_m3').limit(1000),
    ])
    if (p.error) toast.error('Erro: '+p.error.message)
    setRecords(p.data||[])
    setWoodEntries(w.data||[])
    setLoading(false)
  }

  // ── Custo médio da tonelada de madeira (entradas) ──
  function woodTons(w:any) { return parseFloat(w.weight_tons) || parseFloat(w.peso_liquido) || 0 }
  function woodValue(w:any) {
    if (w.total_value) return parseFloat(w.total_value)
    if (w.unit_value && w.volume_m3) return parseFloat(w.unit_value)*parseFloat(w.volume_m3)
    return 0
  }
  const filteredWood = woodEntries.filter(w =>
    (!rFrom || (w.data_entrada||'') >= rFrom) && (!rTo || (w.data_entrada||'') <= rTo))
  const totalWoodTons = filteredWood.reduce((s,w)=>s+woodTons(w),0)
  const totalWoodVal  = filteredWood.reduce((s,w)=>s+woodValue(w),0)
  const avgTonPrice   = totalWoodTons > 0 ? totalWoodVal/totalWoodTons : 0

  function calc(r:any) {
    const tank = parseFloat(r.tank_m3)||0
    const prod = parseFloat(r.produced_m3)||0
    const tons = tank / CONV
    const yieldPct = prod > 0 ? tank/prod : 0        // renda = m³ tanque ÷ m³ produzido
    const cost = tons * avgTonPrice                    // custo total da madeira consumida
    const costPerM3 = prod > 0 ? cost/prod : 0        // custo por m³ produzido
    return { tons, yieldPct, cost, costPerM3 }
  }

  function openNew() {
    setEditing({ prod_date: td(), wood_class:'18 a 24' })
    setModal(true)
  }

  async function save() {
    if (!editing.tank_m3 || parseFloat(editing.tank_m3) <= 0) { toast.error('Informe os m³ do tanque'); return }
    if (!editing.produced_m3 || parseFloat(editing.produced_m3) <= 0) { toast.error('Informe os m³ produzidos'); return }
    setSaving(true)
    const tank = parseFloat(editing.tank_m3), prod = parseFloat(editing.produced_m3)
    const obj = {
      prod_date: editing.prod_date||td(),
      shift: editing.shift||null,
      tank_m3: tank,
      tank_tons: tank/CONV,
      wood_class: editing.wood_class||null,
      produced_m3: prod,
      yield_pct: prod > 0 ? tank/prod : null,
      notes: editing.notes||null,
      created_by: profile?.display_name||'',
    }
    const { error } = editing.id
      ? await supabase.from('production_records').update({...obj, updated_by: profile?.display_name, updated_at: new Date().toISOString()}).eq('id',editing.id)
      : await supabase.from('production_records').insert({...obj, company_id: profile?.company_id||null})
    if (error) { toast.error('Erro: '+error.message); setSaving(false); return }
    toast.success(editing.id?'Atualizado ✅':'Produção registrada ✅')
    setSaving(false); setModal(false); load()
  }

  async function del(id:string) {
    if (!await confirm('Excluir este lançamento?')) return
    const { error } = await supabase.from('production_records').delete().eq('id',id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Excluído'); load()
  }

  // ── Relatório filtrado ──
  const rep = records.filter(r =>
    (!rFrom || r.prod_date >= rFrom) && (!rTo || r.prod_date <= rTo) &&
    (!rClass || r.wood_class === rClass))
  const repTank = rep.reduce((s,r)=>s+(parseFloat(r.tank_m3)||0),0)
  const repProd = rep.reduce((s,r)=>s+(parseFloat(r.produced_m3)||0),0)
  const repTons = repTank / CONV
  const repCost = repTons * avgTonPrice
  const repYield = repProd > 0 ? repTank/repProd : 0
  const repCostM3 = repProd > 0 ? repCost/repProd : 0

  // Média mês corrente
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const monthRecs = records.filter(r => r.prod_date >= monthStart)
  const monthProd = monthRecs.reduce((s,r)=>s+(parseFloat(r.produced_m3)||0),0)

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      doc.setFillColor(6,13,26); doc.rect(0,0,210,25,'F')
      doc.setTextColor(249,115,22); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('Industrial8 — Relatório de Produção', 12, 11)
      doc.setTextColor(148,163,184); doc.setFontSize(8); doc.setFont('helvetica','normal')
      let fi = ''
      if (rFrom||rTo) fi += `Período: ${rFrom?fmtD(rFrom):'início'} a ${rTo?fmtD(rTo):'hoje'} | `
      if (rClass) fi += `Classe: ${rClass}`
      doc.text(fi || `Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 12, 18)

      // Resumo
      autoTable(doc, {
        startY: 30, head: [['Indicador','Valor']],
        body: [
          ['Entrada total de madeira (período)', `${totalWoodTons.toFixed(3)} t`],
          ['Valor total da madeira', money(totalWoodVal)],
          ['Custo médio por tonelada', money(avgTonPrice)],
          ['Total m³ tanque', `${repTank.toFixed(3)} m³`],
          ['Equivalente em toneladas (÷1,4)', `${repTons.toFixed(3)} t`],
          ['Total m³ produzidos', `${repProd.toFixed(3)} m³`],
          ['Média renda de produção', repYield.toFixed(4)],
          ['Custo total de produção', money(repCost)],
          ['Custo por m³ produzido', money(repCostM3)],
        ],
        theme:'grid', headStyles:{fillColor:[249,115,22]}, styles:{fontSize:9},
      })

      const y = (doc as any).lastAutoTable.finalY + 8
      autoTable(doc, {
        startY: y, head: [['Data','Turno','Classe','m³ Tanque','Toneladas','m³ Produzido','Renda','Custo/m³']],
        body: rep.map(r => {
          const c = calc(r)
          return [fmtD(r.prod_date), r.shift||'—', r.wood_class||'—',
            (parseFloat(r.tank_m3)||0).toFixed(2), c.tons.toFixed(3),
            (parseFloat(r.produced_m3)||0).toFixed(2), c.yieldPct.toFixed(4), money(c.costPerM3)]
        }),
        theme:'striped', headStyles:{fillColor:[30,58,110]}, styles:{fontSize:7},
      })
      doc.save(`producao_${td()}.pdf`)
      toast.success('PDF gerado ✅')
    } catch(e:any) { toast.error('Erro ao gerar PDF: '+e.message) }
  }

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="🏭 Produção Diária" action={
        tab==='lancamentos' ? <Btn onClick={openNew} variant="primary" size="sm">+ Lançar</Btn>
                            : <Btn onClick={exportPDF} variant="primary" size="sm">📄 PDF</Btn>
      } />

      <div className="grid grid-cols-3 gap-2 mb-3">
        <KPI num={`${monthProd.toFixed(1)}m³`} label="Produção/mês" color="green" />
        <KPI num={money(avgTonPrice)} label="Custo médio/t" color="orange" />
        <KPI num={repYield>0?repYield.toFixed(3):'—'} label="Renda média" color="purple" />
      </div>

      <div className="flex gap-2 mb-3">
        {([['lancamentos','📝 Lançamentos'],['relatorio','📊 Relatório']] as [Tab,string][]).map(([t,l]) => (
          <div key={t} onClick={()=>setTab(t)}
            style={{ flex:1, textAlign:'center', padding:'8px', borderRadius:'10px', fontSize:'12px', fontWeight:700, cursor:'pointer',
              background: tab===t?'rgba(249,115,22,.12)':'var(--s1)',
              border:`1px solid ${tab===t?'rgba(249,115,22,.4)':'var(--bd)'}`,
              color: tab===t?'#f97316':'var(--t2)' }}>{l}</div>
        ))}
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> : <>

        {/* ═══ LANÇAMENTOS ═══ */}
        {tab==='lancamentos' && (records.length===0 ? <Empty icon="🏭" text="Nenhuma produção lançada." /> : (
          <div className="flex flex-col gap-2">
            {records.map(r => {
              const c = calc(r)
              return (
                <div key={r.id} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm" style={{color:'var(--gn)'}}>{(parseFloat(r.produced_m3)||0).toFixed(2)} m³</span>
                        {r.wood_class && <Badge color="green">{r.wood_class}</Badge>}
                        {r.shift && <Badge color="blue">Turno {r.shift}</Badge>}
                      </div>
                      <div className="text-xs" style={{color:'var(--t2)'}}>
                        📅 {fmtD(r.prod_date)} · 🛢 Tanque: {(parseFloat(r.tank_m3)||0).toFixed(2)} m³ ({c.tons.toFixed(3)} t)
                      </div>
                      <div className="text-xs mt-0.5 flex gap-3" style={{color:'var(--t3)'}}>
                        <span>📊 Renda: {c.yieldPct.toFixed(4)}</span>
                        <span style={{color:'var(--cy)'}}>💰 {money(c.costPerM3)}/m³</span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Btn onClick={()=>{setEditing(r);setModal(true)}} size="sm">✏️</Btn>
                      <Btn onClick={()=>del(r.id)} variant="danger" size="sm">🗑</Btn>
                    </div>
                  </div>
                </div>
              )
            })}
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
              <Select label="Classe da madeira" value={rClass} onChange={setRClass}
                options={[{value:'',label:'Todas as classes'}, ...WOOD_CLASSES.map(c=>({value:c,label:c}))]} />
              {(rFrom||rTo||rClass) && <Btn onClick={()=>{setRFrom('');setRTo('');setRClass('')}} size="sm" variant="secondary">✕ Limpar</Btn>}
            </div>

            {/* Custo de produção */}
            <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid rgba(249,115,22,.25)'}}>
              <div style={{fontSize:'10px',fontWeight:700,color:'#f97316',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>
                💰 CUSTO DE PRODUÇÃO
              </div>
              {[
                ['Entrada total de madeira', `${totalWoodTons.toFixed(3)} t`, 'var(--t1)'],
                ['Valor total da madeira', money(totalWoodVal), 'var(--t1)'],
                ['Custo médio por tonelada', money(avgTonPrice), '#f97316'],
                ['—', '', ''],
                ['Total m³ tanque', `${repTank.toFixed(3)} m³`, 'var(--t1)'],
                ['Equivalente em toneladas (÷1,4)', `${repTons.toFixed(3)} t`, 'var(--t1)'],
                ['Total m³ produzidos', `${repProd.toFixed(3)} m³`, 'var(--gn)'],
                ['—', '', ''],
                ['Média renda produção', repYield.toFixed(4), 'var(--pp)'],
                ['Custo total produção', money(repCost), 'var(--t1)'],
                ['Custo por m³ produzido', money(repCostM3), 'var(--cy)'],
              ].map(([l,v,color],i) =>
                l === '—'
                  ? <div key={i} style={{height:'1px',background:'var(--bd)',margin:'6px 0'}} />
                  : (
                    <div key={i} className="flex justify-between py-1" style={{fontSize:'12px'}}>
                      <span style={{color:'var(--t3)'}}>{l}</span>
                      <span style={{fontWeight:700,color}}>{v}</span>
                    </div>
                  )
              )}
            </div>

            {rep.length===0 ? <Empty icon="📊" text="Nenhum lançamento no período." /> : (
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-2 py-2" style={{gridTemplateColumns:'62px 1fr 1fr 52px 68px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Data</span><span style={{textAlign:'right'}}>Tanque</span><span style={{textAlign:'right'}}>Prod.</span><span style={{textAlign:'right'}}>Renda</span><span style={{textAlign:'right'}}>Custo/m³</span>
                </div>
                {rep.map(r => {
                  const c = calc(r)
                  return (
                    <div key={r.id} className="grid px-2 py-2" style={{gridTemplateColumns:'62px 1fr 1fr 52px 68px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'10px'}}>
                      <span style={{color:'var(--t2)'}}>{fmtD(r.prod_date).slice(0,5)}</span>
                      <span style={{textAlign:'right'}}>{(parseFloat(r.tank_m3)||0).toFixed(1)}</span>
                      <span style={{textAlign:'right',color:'var(--gn)'}}>{(parseFloat(r.produced_m3)||0).toFixed(1)}</span>
                      <span style={{textAlign:'right',color:'var(--pp)'}}>{c.yieldPct.toFixed(2)}</span>
                      <span style={{textAlign:'right',color:'var(--cy)'}}>{c.costPerM3.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </>}

      {/* ═══ MODAL ═══ */}
      <Modal open={modal} onClose={()=>setModal(false)}
        title={editing.id?'Editar Produção':'Lançar Produção'}
        footer={<><Btn onClick={()=>setModal(false)}>Cancelar</Btn>
                <Btn onClick={save} variant="primary" size="md" disabled={saving}>{saving?'Salvando...':'Salvar'}</Btn></>}>

        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data *" value={editing.prod_date} onChange={(v:string)=>setEditing((e:any)=>({...e,prod_date:v}))} type="date" />
          <Select label="Turno" value={editing.shift||''} onChange={(v:string)=>setEditing((e:any)=>({...e,shift:v}))}
            options={[{value:'',label:'—'},{value:'A',label:'A'},{value:'B',label:'B'},{value:'C',label:'C'}]} />
        </div>

        <Select label="Classe da madeira laminada" value={editing.wood_class||'18 a 24'}
          onChange={(v:string)=>setEditing((e:any)=>({...e,wood_class:v}))} options={WOOD_CLASSES} />

        <Input label="Metros cúbicos do TANQUE *" value={editing.tank_m3}
          onChange={(v:string)=>setEditing((e:any)=>({...e,tank_m3:v}))} type="number" placeholder="0.000" />

        {editing.tank_m3 && parseFloat(editing.tank_m3) > 0 && (
          <div style={{fontSize:'11px',color:'var(--cy)',fontWeight:700,marginBottom:'8px'}}>
            ⚖️ Equivale a {(parseFloat(editing.tank_m3)/CONV).toFixed(3)} toneladas (÷ 1,4)
          </div>
        )}

        <Input label="Metros cúbicos PRODUZIDOS *" value={editing.produced_m3}
          onChange={(v:string)=>setEditing((e:any)=>({...e,produced_m3:v}))} type="number" placeholder="0.000" />

        {editing.tank_m3 && editing.produced_m3 && parseFloat(editing.produced_m3) > 0 && (
          <div className="rounded-lg p-2 mb-2" style={{background:'var(--s2)',border:'1px solid var(--bd)'}}>
            <div style={{fontSize:'11px',color:'var(--pp)',fontWeight:700}}>
              📊 Renda: {(parseFloat(editing.tank_m3)/parseFloat(editing.produced_m3)).toFixed(4)}
            </div>
            {avgTonPrice > 0 && (
              <div style={{fontSize:'11px',color:'var(--cy)',fontWeight:700,marginTop:'2px'}}>
                💰 Custo estimado: {money((parseFloat(editing.tank_m3)/CONV*avgTonPrice)/parseFloat(editing.produced_m3))}/m³
              </div>
            )}
          </div>
        )}

        <Textarea label="Observações" value={editing.notes} onChange={(v:string)=>setEditing((e:any)=>({...e,notes:v}))} rows={2} placeholder="Opcional..." />
      </Modal>
    </div>
  )
}
