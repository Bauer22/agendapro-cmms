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
  const [tab, setTab]           = useState<'open'|'all'|'relatorio'|'extrato'>('open')
  const [saldos, setSaldos]     = useState<any[]>([])
  const [extrato, setExtrato]   = useState<any[]>([])
  const [lancs, setLancs]       = useState<any[]>([])
  const [payModal, setPayModal] = useState(false)
  const [newPay, setNewPay]     = useState<any>({})
  const [payTipo, setPayTipo]   = useState<'receber'|'pagar'>('receber')
  const [verExtrato, setVerExtrato] = useState<string|null>(null)
  const [rFrom, setRFrom] = useState(''); const [rTo, setRTo] = useState('')
  const [rCli, setRCli] = useState(''); const [rProd, setRProd] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { loadMeta(); loadExtrato() }, [])

  async function loadExtrato() {
    const [s, e, l] = await Promise.all([
      supabase.from('v_saldo_conta_corrente').select('*'),
      supabase.from('v_extrato_parceiro').select('*'),
      supabase.from('v_extrato_lancamentos').select('*'),
    ])
    if (s.error) { toast.error('Execute o SQL da conta corrente unificada'); return }
    setSaldos(s.data || [])
    setExtrato(e.data || [])
    setLancs(l.data || [])
  }

  async function savePayment() {
    if (!newPay.parceiro) { toast.error('Selecione o parceiro'); return }
    if (!newPay.value || parseFloat(newPay.value) <= 0) { toast.error('Informe o valor'); return }

    const base = {
      payment_date: newPay.payment_date || td(),
      value: parseFloat(newPay.value),
      method: newPay.method || null,
      invoice_ref: newPay.invoice_ref || null,
      notes: newPay.notes || null,
      created_by: profile?.display_name || '',
      company_id: profile?.company_id || null,
    }
    const tabela = payTipo === 'receber' ? 'client_payments' : 'supplier_payments'
    const campos = payTipo === 'receber'
      ? { client_name: newPay.parceiro, client_id: newPay.parceiro_id || null }
      : { supplier_name: newPay.parceiro, supplier_id: newPay.parceiro_id || null }

    const { error } = await supabase.from(tabela).insert({ ...base, ...campos })
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success(payTipo === 'receber' ? 'Recebimento registrado ✅' : 'Pagamento registrado ✅')
    setPayModal(false); setNewPay({}); loadExtrato()
  }

  // Lista de parceiros para o modal (clientes + fornecedores)
  const [parceiros, setParceiros] = useState<any[]>([])
  useEffect(() => {
    supabase.from('cadastros').select('id,nome_razao,is_cliente,is_fornecedor')
      .eq('status', true).or('is_cliente.eq.true,is_fornecedor.eq.true').order('nome_razao')
      .then(({data}) => setParceiros(data || []))
  }, [])
  useEffect(() => { if (tab !== 'relatorio') load() }, [tab])

  async function load() {
    let q = supabase.from('sales_orders').select('*').order('sale_date', { ascending: false }).order('created_at', { ascending: false })
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
        {(['open','all','relatorio','extrato'] as const).map(t => (
          <div key={t} onClick={() => { setTab(t); if(t!=='relatorio' && t!=='extrato') setLoading(true) }}
            style={{ flex:1, textAlign:'center', padding:'7px', borderRadius:'10px', fontSize:'11px', fontWeight:700, cursor:'pointer',
              background: tab===t ? 'rgba(249,115,22,.12)' : 'var(--s1)',
              border: `1px solid ${tab===t ? 'rgba(249,115,22,.4)' : 'var(--bd)'}`,
              color: tab===t ? '#f97316' : 'var(--t2)' }}>
            {t === 'open' ? '📋 Ativos' : t === 'all' ? '📦 Todos' : t === 'relatorio' ? '📊 Relatório' : '🤝 Extrato'}
          </div>
        ))}
      </div>

      {tab === 'extrato' && (
        <>
          <div className="flex justify-between items-center mb-3">
            <span style={{fontSize:'9px',color:'var(--t3)'}}>Vendas − recebido − compras + pago = saldo</span>
            <Btn onClick={()=>{setNewPay({payment_date:td()});setPayTipo('receber');setPayModal(true)}} variant="primary" size="sm">+ Lançar</Btn>
          </div>

          {saldos.length === 0 ? <Empty icon="🤝" text="Sem movimentação. Execute o SQL da conta corrente." /> : (
            <div className="flex flex-col gap-2 mb-4">
              {saldos.map((s:any,i:number)=>{
                const sf = +s.saldo_final || 0
                const bi = s.tipo_relacao === 'CLIENTE E FORNECEDOR'
                return (
                  <div key={i} className="rounded-xl p-3"
                    style={{background:'var(--s1)',border:`1px solid ${sf>0?'rgba(34,197,94,.3)':sf<0?'rgba(239,68,68,.3)':'var(--bd)'}`}}>

                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span style={{fontSize:'13px',fontWeight:800}}>{s.parceiro}</span>
                        {bi && <div style={{fontSize:'8px',color:'var(--pp)',fontWeight:700,marginTop:'1px'}}>🔄 CLIENTE E FORNECEDOR</div>}
                      </div>
                      <Badge color={sf>0?'green':sf<0?'red':'gray'}>{s.situacao}</Badge>
                    </div>

                    {/* Coluna a receber */}
                    {(+s.total_vendas > 0 || +s.creditos_extras > 0) && (
                      <>
                        <div style={{fontSize:'8px',fontWeight:700,color:'var(--gn)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'2px'}}>
                          ▲ Eles nos devem
                        </div>
                        {+s.creditos_extras > 0 && (
                          <div className="flex justify-between py-0.5" style={{fontSize:'11px'}}>
                            <span style={{color:'var(--t3)'}}>📋 Saldo ant. + fretes</span>
                            <span style={{fontWeight:600}}>{money(+s.creditos_extras)}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-0.5" style={{fontSize:'11px'}}>
                          <span style={{color:'var(--t3)'}}>🛒 Vendas ({s.qtd_vendas}) · {(+s.ton_vendidas).toFixed(1)}t</span>
                          <span style={{fontWeight:600,color:'var(--cy)'}}>{money(+s.total_vendas)}</span>
                        </div>
                        <div className="flex justify-between py-0.5" style={{fontSize:'11px'}}>
                          <span style={{color:'var(--t3)'}}>💵 Recebido</span>
                          <span style={{fontWeight:600,color:'var(--gn)'}}>− {money(+s.total_recebido)}</span>
                        </div>
                        <div className="flex justify-between py-0.5" style={{fontSize:'11px',fontWeight:700}}>
                          <span style={{color:'var(--t2)'}}>= A receber</span>
                          <span style={{color:'var(--gn)'}}>{money(+s.a_receber)}</span>
                        </div>
                      </>
                    )}

                    {/* Coluna a pagar */}
                    {(+s.total_compras > 0 || +s.debitos_extras > 0) && (
                      <>
                        <div style={{fontSize:'8px',fontWeight:700,color:'var(--rd)',textTransform:'uppercase',letterSpacing:'.5px',marginTop:'6px',marginBottom:'2px'}}>
                          ▼ Nós devemos
                        </div>
                        {+s.total_compras > 0 && (
                          <div className="flex justify-between py-0.5" style={{fontSize:'11px'}}>
                            <span style={{color:'var(--t3)'}}>🪵 Compras ({s.qtd_compras}) · {(+s.ton_compradas).toFixed(1)}t</span>
                            <span style={{fontWeight:600,color:'var(--rd)'}}>{money(+s.total_compras)}</span>
                          </div>
                        )}
                        {+s.debitos_extras > 0 && (
                          <div className="flex justify-between py-0.5" style={{fontSize:'11px'}}>
                            <span style={{color:'var(--t3)'}}>⚖️ Pesagens / outros</span>
                            <span style={{fontWeight:600,color:'var(--rd)'}}>{money(+s.debitos_extras)}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-0.5" style={{fontSize:'11px'}}>
                          <span style={{color:'var(--t3)'}}>💸 Pago</span>
                          <span style={{fontWeight:600,color:'var(--gn)'}}>− {money(+s.total_pago)}</span>
                        </div>
                        <div className="flex justify-between py-0.5" style={{fontSize:'11px',fontWeight:700}}>
                          <span style={{color:'var(--t2)'}}>= A pagar</span>
                          <span style={{color:'var(--rd)'}}>{money(+s.a_pagar)}</span>
                        </div>
                      </>
                    )}

                    <div style={{height:'1px',background:'var(--bd)',margin:'6px 0'}} />
                    <div className="flex justify-between items-center">
                      <span style={{fontSize:'13px',fontWeight:800}}>SALDO</span>
                      <span style={{fontSize:'15px',fontWeight:800,color:sf>0?'var(--gn)':sf<0?'var(--rd)':'var(--t3)'}}>
                        {money(sf)}
                      </span>
                    </div>
                    <div style={{fontSize:'8px',color:'var(--t3)',textAlign:'right',marginTop:'1px'}}>
                      {sf>0?'eles nos devem':sf<0?'nós devemos':'quitado'}
                    </div>

                    <div className="flex gap-2 mt-2">
                      <Btn onClick={()=>setVerExtrato(verExtrato===s.parceiro?null:s.parceiro)} size="sm" variant="secondary">
                        {verExtrato===s.parceiro?'▲ Fechar':'📄 Extrato'}
                      </Btn>
                      <Btn onClick={()=>{
                        setNewPay({payment_date:td(), parceiro:s.parceiro})
                        setPayTipo(sf>=0?'receber':'pagar')
                        setPayModal(true)
                      }} size="sm" variant="secondary">
                        {sf>=0?'💵 Receber':'💸 Pagar'}
                      </Btn>
                    </div>

                    {/* Extrato detalhado */}
                    {verExtrato===s.parceiro && (
                      <div className="mt-2 rounded-lg overflow-hidden" style={{border:'1px solid var(--bd)'}}>
                        <div className="grid px-2 py-1.5" style={{gridTemplateColumns:'50px 1fr 62px 62px',background:'var(--s2)',fontSize:'8px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                          <span>Data</span><span>Lançamento</span><span style={{textAlign:'right'}}>Crédito</span><span style={{textAlign:'right'}}>Débito</span>
                        </div>
                        {(() => {
                          const L = lancs.filter((l:any)=>l.parceiro===s.parceiro)
                          let acum = 0
                          return L.map((l:any,j:number)=>{
                            acum += (+l.credito||0) - (+l.debito||0)
                            const cor = l.tipo==='VENDA'?'var(--cy)':(l.tipo==='COMPRA MADEIRA'||l.tipo==='COMPRA PINUS')?'var(--rd)':l.tipo==='CRÉDITO'?'var(--am)':l.tipo==='DÉBITO'?'var(--pp)':'var(--gn)'
                            return (
                              <div key={j} className="grid px-2 py-1.5" style={{gridTemplateColumns:'50px 1fr 62px 62px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'9px'}}>
                                <span style={{color:'var(--t3)'}}>{fmtD(l.data)?.slice(0,5)}</span>
                                <div style={{overflow:'hidden'}}>
                                  <div style={{fontWeight:700,color:cor}}>{l.tipo}</div>
                                  <div style={{color:'var(--t3)',fontSize:'8px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                    {l.descricao}{l.documento&&l.documento!=='—'?` · ${l.documento}`:''}{+l.toneladas>0?` · ${(+l.toneladas).toFixed(1)}t`:''}
                                  </div>
                                </div>
                                <span style={{textAlign:'right',color:+l.credito!==0?'var(--gn)':'var(--t3)'}}>
                                  {+l.credito!==0?(+l.credito).toLocaleString('pt-BR',{maximumFractionDigits:0}):'—'}
                                </span>
                                <span style={{textAlign:'right',color:+l.debito!==0?'var(--rd)':'var(--t3)'}}>
                                  {+l.debito!==0?(+l.debito).toLocaleString('pt-BR',{maximumFractionDigits:0}):'—'}
                                </span>
                              </div>
                            )
                          })
                        })()}
                        <div className="px-2 py-1.5 flex justify-between" style={{background:'rgba(249,115,22,.1)',borderTop:'2px solid rgba(249,115,22,.3)',fontSize:'10px',fontWeight:800}}>
                          <span>SALDO FINAL</span>
                          <span style={{color:sf>0?'var(--gn)':'var(--rd)'}}>{money(sf)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Movimento mensal */}
          {extrato.length > 0 && (
            <>
              <div style={{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'6px'}}>
                📆 Movimento mês a mês
              </div>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-2 py-2" style={{gridTemplateColumns:'1fr 44px 60px 60px 62px',background:'var(--s2)',fontSize:'8px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Parceiro</span><span>Mês</span><span style={{textAlign:'right'}}>Vendas</span><span style={{textAlign:'right'}}>Compras</span><span style={{textAlign:'right'}}>Saldo</span>
                </div>
                {extrato.map((e:any,i:number)=>(
                  <div key={i} className="grid px-2 py-2" style={{gridTemplateColumns:'1fr 44px 60px 60px 62px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'9px'}}>
                    <span style={{fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.parceiro}</span>
                    <span style={{color:'var(--t3)'}}>{e.mes?.slice(5)}/{e.mes?.slice(2,4)}</span>
                    <span style={{textAlign:'right',color:'var(--cy)'}}>{+e.vendas>0?(+e.vendas).toLocaleString('pt-BR',{maximumFractionDigits:0}):'—'}</span>
                    <span style={{textAlign:'right',color:'var(--rd)'}}>{+e.compras>0?(+e.compras).toLocaleString('pt-BR',{maximumFractionDigits:0}):'—'}</span>
                    <span style={{textAlign:'right',fontWeight:700,color:+e.saldo_mes>0?'var(--gn)':+e.saldo_mes<0?'var(--rd)':'var(--t3)'}}>
                      {(+e.saldo_mes).toLocaleString('pt-BR',{maximumFractionDigits:0})}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Modal de lançamento */}
          <Modal open={payModal} onClose={()=>setPayModal(false)} title={payTipo==='receber'?'💵 Registrar Recebimento':'💸 Registrar Pagamento'}
            footer={<><Btn onClick={()=>setPayModal(false)}>Cancelar</Btn><Btn onClick={savePayment} variant="primary" size="md">Salvar</Btn></>}>

            <div className="flex gap-2 mb-3">
              {([['receber','💵 Recebi (cliente pagou)'],['pagar','💸 Paguei (para fornecedor)']] as ['receber'|'pagar',string][]).map(([k,l])=>(
                <div key={k} onClick={()=>setPayTipo(k)}
                  style={{flex:1,textAlign:'center',padding:'8px',borderRadius:'10px',fontSize:'10px',fontWeight:700,cursor:'pointer',
                    background:payTipo===k?'rgba(249,115,22,.12)':'var(--s2)',
                    border:`1px solid ${payTipo===k?'rgba(249,115,22,.4)':'var(--bd)'}`,
                    color:payTipo===k?'#f97316':'var(--t2)'}}>{l}</div>
              ))}
            </div>

            <Select label="Parceiro *" value={newPay.parceiro||''} onChange={(v:string)=>{
                const pc = parceiros.find((x:any)=>x.nome_razao===v)
                setNewPay((e:any)=>({...e, parceiro:v, parceiro_id: pc?.id||null}))
              }}
              options={[{value:'',label:'Selecione...'}, ...parceiros
                .filter((p:any)=> payTipo==='receber' ? p.is_cliente : p.is_fornecedor)
                .map((p:any)=>({value:p.nome_razao,label:p.nome_razao}))]} />

            <div className="grid grid-cols-2 gap-x-3">
              <Input label="Data *" value={newPay.payment_date} onChange={(v:string)=>setNewPay((e:any)=>({...e,payment_date:v}))} type="date" />
              <Input label="Valor R$ *" value={newPay.value} onChange={(v:string)=>setNewPay((e:any)=>({...e,value:v}))} type="number" placeholder="0.00" />
            </div>
            <Select label="Forma" value={newPay.method||''} onChange={(v:string)=>setNewPay((e:any)=>({...e,method:v}))}
              options={[{value:'',label:'—'},{value:'PIX',label:'PIX'},{value:'Transferência',label:'Transferência'},{value:'Boleto',label:'Boleto'},{value:'Dinheiro',label:'Dinheiro'},{value:'Cheque',label:'Cheque'},{value:'Compensação',label:'Compensação (troca)'}]} />
            <Input label="NF / documento de referência" value={newPay.invoice_ref} onChange={(v:string)=>setNewPay((e:any)=>({...e,invoice_ref:v}))} placeholder="Opcional" />
            <Textarea label="Observações" value={newPay.notes} onChange={(v:string)=>setNewPay((e:any)=>({...e,notes:v}))} rows={2} placeholder="Opcional..." />
          </Modal>
        </>
      )}

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

      {tab !== 'relatorio' && tab !== 'extrato' && (loading ? <Empty icon="⏳" text="Carregando..." /> :
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
