'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

function maskPlate(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7)
}

const STATUS_C: Record<string,string> = { active:'green', cancelled:'red' }

export default function SalesPage({ profile, can }: Props) {
  const [orders, setOrders]     = useState<any[]>([])
  const [clients, setClients]   = useState<any[]>([])
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [veiculos, setVeiculos] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [modal, setModal]       = useState(false)
  const [clientModal, setClientModal] = useState(false)
  const [productModal, setProductModal] = useState(false)
  const [view, setView]         = useState<any>(null)
  const [editing, setEditing]   = useState<any>({})
  const [newClient, setNewClient] = useState<any>({})
  const [newProduct, setNewProduct] = useState<any>({})
  const [tab, setTab]           = useState<'open'|'all'|'relatorio'>('open')
  const [rFrom, setRFrom] = useState(''); const [rTo, setRTo] = useState('')
  const [rCli, setRCli] = useState(''); const [rProd, setRProd] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { loadMeta() }, [])
  useEffect(() => { if (tab !== 'relatorio') load() }, [tab])

  async function load() {
    let q = supabase.from('sales_orders').select('*').order('created_at', { ascending: false })
    if (tab === 'open') q = q.eq('status', 'active')
    const { data, error } = await q
    if (error) toast.error('Erro: ' + error.message)
    setOrders(data || [])
    setLoading(false)
  }

  async function loadMeta() {
    const [cli, prd, mot, veic] = await Promise.all([
      supabase.from('cadastros').select('id,nome_razao').eq('is_cliente', true).eq('status', true).order('nome_razao'),
      supabase.from('products').select('id,name,unit').eq('active', true).order('name'),
      supabase.from('cadastros').select('id,nome_razao').eq('is_motorista', true).eq('status', true).order('nome_razao'),
      supabase.from('veiculos').select('id,placa,tipo').eq('status', true).order('placa'),
    ])
    setClients((cli.data||[]).map((x:any)=>({id:x.id,name:x.nome_razao})))
    setProducts(prd.data || [])
    setMotoristas((mot.data||[]).map((x:any)=>({id:x.id,name:x.nome_razao})))
    setVeiculos(veic.data||[])
  }

  function openNew() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2,'0')
    const mm = String(now.getMinutes()).padStart(2,'0')
    setEditing({
      sale_date: td(),
      exit_time: `${hh}:${mm}`,
      status: 'active',
    })
    setModal(true)
  }

  async function save() {
    if (!editing.client_id)     { toast.error('Selecione o cliente'); return }
    if (!editing.product_id)    { toast.error('Selecione o produto'); return }
    if (!editing.driver?.trim()) { toast.error('Informe o motorista'); return }
    if (!editing.plate?.trim()) { toast.error('Informe a placa'); return }
    const hasQty = (editing.weight_tons && parseFloat(editing.weight_tons) > 0) ||
                   (editing.volume_m3 && parseFloat(editing.volume_m3) > 0)
    if (!hasQty) { toast.error('Informe ao menos Toneladas ou Metros'); return }

    setSaving(true)

    const cli = clients.find(c => c.id === editing.client_id)
    const prd = products.find(p => p.id === editing.product_id)
    const obj = {
      sale_date:    editing.sale_date || td(),
      exit_time:    editing.exit_time,
      client_id:    editing.client_id,
      client_name:  cli?.name || '',
      product_id:   editing.product_id,
      product_name: prd?.name || '',
      weight_tons:  editing.weight_tons ? parseFloat(editing.weight_tons) : null,
      volume_m3:    editing.volume_m3 ? parseFloat(editing.volume_m3) : null,
      unit_price:   editing.unit_price ? parseFloat(editing.unit_price) : null,
      total_value:  editing.total_value ? parseFloat(editing.total_value) : null,
      invoice:      editing.invoice || null,
      payment_status: editing.payment_status || null,
      plate:        editing.plate.trim().toUpperCase(),
      driver:       editing.driver.trim(),
      status:       editing.status || 'active',
      notes:        editing.notes || null,
      created_by:   profile?.display_name || '',
      created_by_id: profile?.id || null,
    }

    const { error } = editing.id
      ? await supabase.from('sales_orders').update({ ...obj, updated_by: profile?.display_name, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('sales_orders').insert(obj)

    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }

    // Audit trail
    await supabase.from('audit_trail').insert({
      table_name: 'sales_orders',
      record_id: editing.id || null,
      action: editing.id ? 'UPDATE' : 'INSERT',
      new_data: obj,
      user_id: profile?.id,
      user_name: profile?.display_name,
    }).then(() => {})

    toast.success(editing.id ? 'Romaneio atualizado ✅' : 'Romaneio gerado ✅')
    setSaving(false)
    setModal(false)
    load()
  }

  async function saveClient() {
    if (!newClient.name) { toast.error('Informe o nome do cliente'); return }
    const { error } = await supabase.from('cadastros').insert({
      nome_razao: newClient.name, documento: newClient.document||null,
      telefone: newClient.phone||null, email: newClient.email||null,
      endereco: newClient.address||null, is_cliente: true,
      status: true, company_id: profile?.company_id||null,
      created_by: profile?.display_name||''
    })
    if (error) { toast.error(error.message); return }
    toast.success('Cliente cadastrado ✅')
    setClientModal(false); setNewClient({})
    loadMeta()
  }

  async function saveProduct() {
    if (!newProduct.name) { toast.error('Informe o nome do produto'); return }
    const { error } = await supabase.from('products').insert({ ...newProduct, active: true, unit: newProduct.unit || 'ton' })
    if (error) { toast.error(error.message); return }
    toast.success('Produto cadastrado ✅')
    setProductModal(false); setNewProduct({})
    loadMeta()
  }

  async function cancel(id: string) {
    if (!await confirm('Cancelar este romaneio?')) return
    const { error } = await supabase.from('sales_orders').update({ status: 'cancelled', updated_by: profile?.display_name, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Romaneio cancelado'); load()
  }

  // ── Relatório ──
  const money = (v:number) => `R$ ${(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
  const rep = orders.filter(o =>
    (!rFrom || (o.sale_date||'') >= rFrom) && (!rTo || (o.sale_date||'') <= rTo) &&
    (!rCli || o.client_id === rCli) && (!rProd || o.product_id === rProd) && o.status === 'active')
  const repTons = rep.reduce((s,o)=>s+(parseFloat(o.weight_tons)||0),0)
  const repM3   = rep.reduce((s,o)=>s+(parseFloat(o.volume_m3)||0),0)
  const repVal  = rep.reduce((s,o)=>s+(parseFloat(o.total_value)||0),0)

  const byProd: Record<string,{nome:string;tons:number;m3:number;qtd:number;val:number}> = {}
  rep.forEach(o => {
    const k = o.product_name || '—'
    if (!byProd[k]) byProd[k] = {nome:k, tons:0, m3:0, qtd:0, val:0}
    byProd[k].tons += parseFloat(o.weight_tons)||0
    byProd[k].m3   += parseFloat(o.volume_m3)||0
    byProd[k].val  += parseFloat(o.total_value)||0
    byProd[k].qtd  += 1
  })
  const prodRows = Object.values(byProd).sort((a,b)=>b.tons-a.tons)

  const byCli: Record<string,{nome:string;tons:number;m3:number;qtd:number;val:number}> = {}
  rep.forEach(o => {
    const k = o.client_name || '—'
    if (!byCli[k]) byCli[k] = {nome:k, tons:0, m3:0, qtd:0, val:0}
    byCli[k].tons += parseFloat(o.weight_tons)||0
    byCli[k].m3   += parseFloat(o.volume_m3)||0
    byCli[k].val  += parseFloat(o.total_value)||0
    byCli[k].qtd  += 1
  })
  const cliRows = Object.values(byCli).sort((a,b)=>b.tons-a.tons)

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      doc.setFillColor(6,13,26); doc.rect(0,0,210,25,'F')
      doc.setTextColor(249,115,22); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('Industrial8 — Relatório de Vendas', 12, 11)
      doc.setTextColor(148,163,184); doc.setFontSize(8); doc.setFont('helvetica','normal')
      let fi = ''
      if (rFrom||rTo) fi += `Período: ${rFrom?fmtD(rFrom):'início'} a ${rTo?fmtD(rTo):'hoje'} | `
      if (rCli) fi += `Cliente: ${clients.find(x=>x.id===rCli)?.name||''} | `
      if (rProd) fi += `Produto: ${products.find(x=>x.id===rProd)?.name||''}`
      doc.text(fi || `Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 12, 18)

      autoTable(doc, {
        startY: 30, head: [['Produto','Romaneios','Toneladas','Metros','Faturado']],
        body: prodRows.map(p=>[p.nome, String(p.qtd), p.tons.toFixed(3), p.m3.toFixed(2), money(p.val)]),
        foot: [['TOTAL', String(rep.length), repTons.toFixed(3), repM3.toFixed(2), money(repVal)]],
        theme:'grid', headStyles:{fillColor:[249,115,22]}, footStyles:{fillColor:[30,58,110]}, styles:{fontSize:8},
      })
      let y = (doc as any).lastAutoTable.finalY + 8
      autoTable(doc, {
        startY: y, head: [['Cliente','Romaneios','Toneladas','Metros','Faturado']],
        body: cliRows.map(x=>[x.nome, String(x.qtd), x.tons.toFixed(3), x.m3.toFixed(2), money(x.val)]),
        theme:'grid', headStyles:{fillColor:[59,130,246]}, styles:{fontSize:8},
      })
      y = (doc as any).lastAutoTable.finalY + 8
      autoTable(doc, {
        startY: y, head: [['Romaneio','NF','Data','Cliente','Produto','Ton','m³','Valor','Pgto']],
        body: rep.map(o=>[String(o.romaneio_num||''), o.invoice||'—', fmtD(o.sale_date), o.client_name||'—', o.product_name||'—',
          o.weight_tons?parseFloat(o.weight_tons).toFixed(2):'—', o.volume_m3?parseFloat(o.volume_m3).toFixed(1):'—',
          o.total_value?money(o.total_value):'—', o.payment_status==='pago'?'Pago':o.payment_status==='pendente'?'Pend.':'—']),
        theme:'striped', headStyles:{fillColor:[30,58,110]}, styles:{fontSize:7},
      })
      doc.save(`vendas_${td()}.pdf`)
      toast.success('PDF gerado ✅')
    } catch(err:any) { toast.error('Erro ao gerar PDF: '+err.message) }
  }

  const totalTons = orders.filter(o => o.status === 'active').reduce((s,o) => s + (parseFloat(o.weight_tons)||0), 0)
  const todayCount = orders.filter(o => o.sale_date === td() && o.status === 'active').length

  return (
    <div className="page-enter p-3">
      {dialog}

      <SH label="🛒 Vendas / Romaneio" action={
        <div className="flex gap-1">
          <Btn onClick={() => setClientModal(true)} variant="secondary" size="sm">+ Cliente</Btn>
          <Btn onClick={() => setProductModal(true)} variant="secondary" size="sm">+ Produto</Btn>
          <Btn onClick={openNew} variant="primary" size="sm">+ Romaneio</Btn>
        </div>
      } />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <KPI num={`${totalTons.toFixed(1)} t`} label="Toneladas saídas" color="orange" />
        <KPI num={todayCount} label="Romaneios hoje" color="blue" />
      </div>

      <div className="flex gap-2 mb-3">
        {(['open','all','relatorio'] as const).map(t => (
          <div key={t} onClick={() => { setTab(t); if(t!=='relatorio') setLoading(true) }}
            style={{ flex:1, textAlign:'center', padding:'7px', borderRadius:'10px', fontSize:'11px', fontWeight:700, cursor:'pointer',
              background: tab===t ? 'rgba(249,115,22,.12)' : 'var(--s1)',
              border: `1px solid ${tab===t ? 'rgba(249,115,22,.4)' : 'var(--bd)'}`,
              color: tab===t ? '#f97316' : 'var(--t2)' }}>
            {t === 'open' ? '📋 Ativos' : t === 'all' ? '📦 Todos' : '📊 Relatório'}
          </div>
        ))}
      </div>

      {tab === 'relatorio' && (
        <>
          <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div style={{fontSize:'9px',fontWeight:700,color:'rgba(249,115,22,.65)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>FILTROS</div>
            <div className="grid grid-cols-2 gap-x-3">
              <Input label="De" value={rFrom} onChange={setRFrom} type="date" />
              <Input label="Até" value={rTo} onChange={setRTo} type="date" />
            </div>
            <Select label="Cliente" value={rCli} onChange={setRCli}
              options={[{value:'',label:'Todos os clientes'}, ...clients.map(x=>({value:x.id,label:x.name}))]} />
            <Select label="Produto" value={rProd} onChange={setRProd}
              options={[{value:'',label:'Todos os produtos'}, ...products.map(x=>({value:x.id,label:x.name}))]} />
            <div className="flex gap-2">
              {(rFrom||rTo||rCli||rProd) && <Btn onClick={()=>{setRFrom('');setRTo('');setRCli('');setRProd('')}} size="sm" variant="secondary">✕ Limpar</Btn>}
              <Btn onClick={exportPDF} size="sm" variant="primary">📄 Exportar PDF</Btn>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            <KPI num={rep.length} label="Romaneios" color="blue" />
            <KPI num={`${repTons.toFixed(1)}t`} label="Toneladas" color="orange" />
            <KPI num={`${repM3.toFixed(1)}m³`} label="Metros" color="green" />
            <KPI num={money(repVal).replace('R$ ','R$')} label="Faturado" color="purple" />
          </div>

          {prodRows.length === 0 ? <Empty icon="📊" text="Nenhuma venda no período." /> : (
            <>
              <div style={{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'6px'}}>📦 Por Produto</div>
              <div className="rounded-xl overflow-hidden mb-3" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 36px 56px 52px 76px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Produto</span><span style={{textAlign:'right'}}>Qtd</span><span style={{textAlign:'right'}}>Ton</span><span style={{textAlign:'right'}}>m³</span><span style={{textAlign:'right'}}>Valor</span>
                </div>
                {prodRows.map((x,i)=>(
                  <div key={i} className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 36px 56px 52px 76px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'11px'}}>
                    <span style={{fontWeight:700}}>{x.nome}</span>
                    <span style={{textAlign:'right',color:'var(--t2)'}}>{x.qtd}</span>
                    <span style={{textAlign:'right',color:'var(--cy)'}}>{x.tons.toFixed(1)}</span>
                    <span style={{textAlign:'right',color:'var(--gn)'}}>{x.m3.toFixed(1)}</span>
                    <span style={{textAlign:'right',color:'#f97316',fontWeight:700}}>{x.val>0?money(x.val).replace('R$ ',''):'—'}</span>
                  </div>
                ))}
              </div>

              <div style={{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'6px'}}>🤝 Por Cliente</div>
              <div className="rounded-xl overflow-hidden mb-3" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 36px 56px 52px 76px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Cliente</span><span style={{textAlign:'right'}}>Qtd</span><span style={{textAlign:'right'}}>Ton</span><span style={{textAlign:'right'}}>m³</span><span style={{textAlign:'right'}}>Valor</span>
                </div>
                {cliRows.map((x,i)=>(
                  <div key={i} className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 36px 56px 52px 76px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'11px'}}>
                    <span style={{fontWeight:700}}>{x.nome}</span>
                    <span style={{textAlign:'right',color:'var(--t2)'}}>{x.qtd}</span>
                    <span style={{textAlign:'right',color:'var(--cy)'}}>{x.tons.toFixed(1)}</span>
                    <span style={{textAlign:'right',color:'var(--gn)'}}>{x.m3.toFixed(1)}</span>
                    <span style={{textAlign:'right',color:'#f97316',fontWeight:700}}>{x.val>0?money(x.val).replace('R$ ',''):'—'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab !== 'relatorio' && (loading ? <Empty icon="⏳" text="Carregando..." /> :
       orders.length === 0 ? <Empty icon="🛒" text="Nenhum romaneio encontrado." /> : (
        <div className="flex flex-col gap-2">
          {orders.map(o => (
            <div key={o.id} onClick={() => setView(o)}
              className="rounded-xl p-3 cursor-pointer"
              style={{ background:'var(--s1)', border:`1px solid ${o.status==='cancelled'?'rgba(239,68,68,.3)':'var(--bd)'}` }}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold" style={{ color:'var(--cy)', fontSize:'13px' }}>
                      Nº {o.romaneio_num}
                    </span>
                    {o.invoice && <span className="text-xs" style={{color:'var(--t3)'}}>NF {o.invoice}</span>}
                    {o.payment_status && <Badge color={o.payment_status==='pago'?'green':'amber'}>{o.payment_status==='pago'?'✅ Pago':'⏳ Pendente'}</Badge>}
                    <Badge color={STATUS_C[o.status]||'gray'}>
                      {o.status === 'active' ? '✅ Ativo' : '❌ Cancelado'}
                    </Badge>
                  </div>
                  <div className="font-bold text-sm">{o.client_name}</div>
                  <div className="text-xs mt-0.5" style={{ color:'var(--t2)' }}>
                    {o.product_name} · {o.weight_tons ? `${parseFloat(o.weight_tons).toFixed(3)} t` : ''}{o.volume_m3 ? ` · ${parseFloat(o.volume_m3).toFixed(2)} m³` : ''}
                  </div>
                  <div className="text-xs" style={{ color:'var(--t3)' }}>
                    📅 {fmtD(o.sale_date)}{o.exit_time ? ' às ' + o.exit_time.slice(0,5) : ''}
                    {o.driver ? ' · 🚗 ' + o.driver : ''}
                    {o.plate ? ' · 🚛 ' + o.plate : ''}
                  </div>
                  {o.total_value > 0 && (
                    <div className="text-xs font-bold mt-0.5" style={{color:'#f97316'}}>
                      {money(o.total_value)}{o.unit_price ? ` (${money(o.unit_price)}/un)` : ''}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-2" onClick={ev => ev.stopPropagation()}>
                  {o.status === 'active' && <>
                    <Btn onClick={() => { setEditing(o); setModal(true) }} size="sm">✏️</Btn>
                    <Btn onClick={() => cancel(o.id)} variant="danger" size="sm">✕</Btn>
                  </>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Detalhe */}
      <Modal open={!!view} onClose={() => setView(null)} title={`Romaneio Nº ${view?.romaneio_num || ''}`}>
        {view && (
          <div className="flex flex-col gap-1">
            {[
              ['Nº Romaneio', String(view.romaneio_num)],
              ['Data', fmtD(view.sale_date)],
              ['Hora Saída', view.exit_time?.slice(0,5) || '—'],
              ['Cliente', view.client_name || '—'],
              ['Produto', view.product_name || '—'],
              ['Toneladas', view.weight_tons ? `${parseFloat(view.weight_tons).toFixed(3)} t` : '—'],
              ['Metros (m³)', view.volume_m3 ? `${parseFloat(view.volume_m3).toFixed(2)} m³` : '—'],
              ['Motorista', view.driver || '—'],
              ['Placa', view.plate || '—'],
              ['Nº Nota Fiscal', view.invoice || '—'],
              ['Valor unitário', view.unit_price ? money(view.unit_price) : '—'],
              ['Valor total', view.total_value ? money(view.total_value) : '—'],
              ['Pagamento', view.payment_status === 'pago' ? '✅ Pago' : view.payment_status === 'pendente' ? '⏳ Pendente' : '—'],
              ['Observações', view.notes || '—'],
              ['Registrado por', view.created_by || '—'],
              ['Status', view.status === 'active' ? '✅ Ativo' : '❌ Cancelado'],
            ].map(([l,v],i) => (
              <div key={i} className="flex justify-between py-1.5 border-b" style={{ borderColor:'var(--bd)', fontSize:'12px' }}>
                <span style={{ color:'var(--t3)' }}>{l}</span>
                <span style={{ fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Novo Romaneio */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing.id ? `Editar Romaneio Nº ${editing.romaneio_num}` : 'Novo Romaneio'}
        footer={
          <>
            <Btn onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save} variant="primary" size="md" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Btn>
          </>
        }>

        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data *" value={editing.sale_date} onChange={(v:string) => setEditing((e:any) => ({...e, sale_date:v}))} type="date" />
          <Input label="Hora Saída *" value={editing.exit_time} onChange={(v:string) => setEditing((e:any) => ({...e, exit_time:v}))} type="time" />
        </div>

        <Select label="Cliente *" value={editing.client_id||''} onChange={(v:string) => setEditing((e:any) => ({...e, client_id:v}))}
          options={[{value:'',label:'Selecione o cliente...'}, ...clients.map(c => ({value:c.id, label:c.name}))]} />

        <Select label="Produto *" value={editing.product_id||''} onChange={(v:string) => setEditing((e:any) => ({...e, product_id:v}))}
          options={[{value:'',label:'Selecione o produto...'}, ...products.map(p => ({value:p.id, label:p.name}))]} />

        <div style={{fontSize:'9px',fontWeight:700,color:'rgba(249,115,22,.65)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px',marginTop:'4px'}}>
          ⚠️ Preencha ao menos Toneladas ou Metros
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Toneladas" value={editing.weight_tons} onChange={(v:string) => setEditing((e:any) => ({...e, weight_tons:v}))} type="number" placeholder="0.000" />
          <Input label="Metros (m³/ster)" value={editing.volume_m3} onChange={(v:string) => setEditing((e:any) => ({...e, volume_m3:v}))} type="number" placeholder="0.00" />
        </div>

        <div style={{fontSize:'9px',fontWeight:700,color:'rgba(249,115,22,.65)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px',marginTop:'4px'}}>
          💰 FATURAMENTO (opcional)
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Nº Nota Fiscal" value={editing.invoice} onChange={(v:string) => setEditing((e:any) => ({...e, invoice:v}))} placeholder="Ex: 873" />
          <Select label="Pagamento" value={editing.payment_status||''} onChange={(v:string) => setEditing((e:any) => ({...e, payment_status:v}))}
            options={[{value:'',label:'—'},{value:'pago',label:'✅ Pago'},{value:'pendente',label:'⏳ Pendente'}]} />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Valor unitário R$" value={editing.unit_price} onChange={(v:string) => {
            const qtd = parseFloat(editing.weight_tons) || parseFloat(editing.volume_m3) || 0
            const up = parseFloat(v) || 0
            setEditing((e:any) => ({...e, unit_price:v, total_value: qtd>0&&up>0 ? (qtd*up).toFixed(2) : e.total_value}))
          }} type="number" placeholder="0.00" />
          <Input label="Valor total R$" value={editing.total_value} onChange={(v:string) => setEditing((e:any) => ({...e, total_value:v}))} type="number" placeholder="0.00" />
        </div>

        {motoristas.length > 0 ? (
          <Select label="Motorista *" value={editing.driver_id||''} onChange={(v:string) => {
            const m = motoristas.find(x=>x.id===v)
            setEditing((e:any)=>({...e, driver_id:v, driver: m?.name||''}))
          }} options={[{value:'',label:'Selecione o motorista...'}, ...motoristas.map(m=>({value:m.id,label:m.name}))]} />
        ) : (
          <Input label="Motorista *" value={editing.driver} onChange={(v:string) => setEditing((e:any) => ({...e, driver:v}))} placeholder="Nome completo do motorista" />
        )}
        {veiculos.length > 0 ? (
          <Select label="Placa / Veículo *" value={editing.veiculo_id||''} onChange={(v:string) => {
            const ve = veiculos.find(x=>x.id===v)
            setEditing((e:any)=>({...e, veiculo_id:v, plate: ve?.placa||''}))
          }} options={[{value:'',label:'Selecione o veículo...'}, ...veiculos.map(ve=>({value:ve.id,label:`${ve.placa} (${ve.tipo})`}))]} />
        ) : (
          <Input label="Placa *" value={editing.plate} onChange={(v:string) => setEditing((e:any) => ({...e, plate:maskPlate(v)}))} placeholder="AAA0A00 ou AAA0000" />
        )}
        <Textarea label="Observações" value={editing.notes} onChange={(v:string) => setEditing((e:any) => ({...e, notes:v}))} rows={2} placeholder="Opcional..." />
      </Modal>

      {/* Cadastro rápido de cliente */}
      <Modal open={clientModal} onClose={() => setClientModal(false)} title="Novo Cliente"
        footer={<><Btn onClick={() => setClientModal(false)}>Cancelar</Btn><Btn onClick={saveClient} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Nome *" value={newClient.name} onChange={(v:string) => setNewClient((e:any) => ({...e, name:v}))} placeholder="Nome do cliente" />
        <Input label="CPF / CNPJ" value={newClient.document} onChange={(v:string) => setNewClient((e:any) => ({...e, document:v}))} placeholder="000.000.000-00" />
        <Input label="Telefone" value={newClient.phone} onChange={(v:string) => setNewClient((e:any) => ({...e, phone:v}))} type="tel" placeholder="(00) 00000-0000" />
        <Input label="E-mail" value={newClient.email} onChange={(v:string) => setNewClient((e:any) => ({...e, email:v}))} type="email" placeholder="cliente@email.com" />
        <Input label="Endereço" value={newClient.address} onChange={(v:string) => setNewClient((e:any) => ({...e, address:v}))} placeholder="Endereço completo" />
      </Modal>

      {/* Cadastro rápido de produto */}
      <Modal open={productModal} onClose={() => setProductModal(false)} title="Novo Produto"
        footer={<><Btn onClick={() => setProductModal(false)}>Cancelar</Btn><Btn onClick={saveProduct} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Nome do Produto *" value={newProduct.name} onChange={(v:string) => setNewProduct((e:any) => ({...e, name:v}))} placeholder="Ex: Lenha Picada, Cavaco..." />
        <Select label="Unidade" value={newProduct.unit||'ton'} onChange={(v:string) => setNewProduct((e:any) => ({...e, unit:v}))}
          options={['ton','ster','m³','kg','unid']} />
      </Modal>
    </div>
  )
}
