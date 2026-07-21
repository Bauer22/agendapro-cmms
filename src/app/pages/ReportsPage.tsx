'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, SH, Input, Select } from '@/components/ui'
import { fmtD, STATUS_INFO } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const REPORT_MODULES = [
  {id:'os',       icon:'📋', title:'Ordens de Serviço',    desc:'OS com filtro por status, máquina e datas'},
  {id:'maint',    icon:'🔧', title:'Histórico Manutenção', desc:'Registros por máquina, tipo e responsável'},
  {id:'pm',       icon:'📝', title:'Relatórios MP',        desc:'Preventivas por período e máquina'},
  {id:'parts',    icon:'📦', title:'Inventário de Peças',  desc:'Estoque atual com alertas e movimentos'},
  {id:'po',       icon:'🛒', title:'Pedidos de Compra',    desc:'Pedidos por status e fornecedor'},
  {id:'finance',  icon:'💰', title:'Contas a Pagar',       desc:'Pagamentos por status e vencimento'},
  {id:'financeiro_completo', icon:'📊', title:'Financeiro Completo', desc:'Pagamentos do período + resumo por centro de custo'},
  {id:'parceiro', icon:'🤝', title:'Relatório por Parceiro', desc:'Compras, vendas, saldo e viagens por motorista — selecione o parceiro abaixo'},
  {id:'backup',   icon:'💾', title:'Backup Completo',      desc:'Exportar todos os dados em JSON'},
  {id:'oee',      icon:'📈', title:'Relatório OEE',         desc:'Disponibilidade, performance e qualidade por máquina'},
  {id:'wood',     icon:'🪵', title:'Entrada de Madeira',    desc:'Volume, espécie, origem e valor por período'},
  {id:'sales',    icon:'🛒', title:'Pedidos de Venda',      desc:'Pedidos por status, cliente e período'},
  {id:'epi',      icon:'🦺', title:'Entregas de EPI',       desc:'Histórico de entregas por funcionário'},
  {id:'training', icon:'🎓', title:'Treinamentos',          desc:'Status e validade por funcionário'},
  {id:'audit',    icon:'🔍', title:'Auditorias',            desc:'Scores e pendências por período'},
  {id:'energy',   icon:'⚡', title:'Consumo de Energia',    desc:'Consumo e custo por fonte e setor'},
]

export default function ReportsPage({ profile, can }: Props) {
  const [machines, setMachines]   = useState<any[]>([])
  const [users, setUsers]         = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [summary, setSummary]     = useState<any>({})
  const [loading, setLoad]        = useState(true)
  const [generating, setGen]      = useState('')

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [fMach, setFMach]       = useState('')
  const [fUser, setFUser]       = useState('')
  const [fStatus, setFStatus]   = useState('')
  const [fParceiro, setFParceiro] = useState('')
  const [parceiros, setParceiros] = useState<any[]>([])

  useEffect(() => { loadMeta() }, [])

  async function loadMeta() {
    const [m, u, s, os, maint, parts, pm, cad] = await Promise.all([
      supabase.from('machines').select('id,name,icon'),
      supabase.from('profiles').select('id,display_name,email'),
      supabase.from('suppliers').select('id,name,razao_social'),
      supabase.from('work_orders').select('status'),
      supabase.from('maintenance').select('status'),
      supabase.from('parts').select('stock,min_stock'),
      supabase.from('pm_reports').select('id'),
      supabase.from('cadastros').select('id,nome_razao').eq('status',true)
        .or('is_cliente.eq.true,is_fornecedor.eq.true').order('nome_razao'),
    ])
    setMachines(m.data||[]); setUsers(u.data||[]); setSuppliers(s.data||[])
    setParceiros(cad.data||[])
    const osList = os.data||[]
    const pList  = parts.data||[]
    setSummary({
      osOpen:     osList.filter((o:any)=>o.status==='open').length,
      osDone:     osList.filter((o:any)=>o.status==='done').length,
      osTotal:    osList.length,
      maintTotal: (maint.data||[]).length,
      maintOpen:  (maint.data||[]).filter((r:any)=>!r.status||r.status==='open').length,
      partsLow:   pList.filter((p:any)=>p.stock<=p.min_stock).length,
      pmTotal:    (pm.data||[]).length,
    })
    setLoad(false)
  }

  function buildDateFilter(query: any, dateField='created_at') {
    if (dateFrom) query = query.gte(dateField, dateFrom)
    if (dateTo)   query = query.lte(dateField, dateTo+'T23:59:59')
    return query
  }

  async function generate(moduleId: string) {
    if (moduleId === 'parceiro' && !fParceiro) {
      toast.error('Selecione um parceiro no filtro acima antes de gerar este relatório')
      return
    }
    setGen(moduleId)
    try {
      // Dynamic import of jsPDF
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      const now = new Date()
      const dateStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`

      // Header
      doc.setFillColor(6,13,26)
      doc.rect(0,0,210,25,'F')
      doc.setTextColor(0,212,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('Industrial8', 12, 11)
      doc.setTextColor(148,163,184); doc.setFontSize(8); doc.setFont('helvetica','normal')
      doc.text(`Gerado em: ${dateStr} por ${profile?.display_name||''}`, 12, 18)

      // Filters info
      let filterInfo = ''
      if (dateFrom||dateTo) filterInfo += `Período: ${dateFrom?fmtD(dateFrom):'início'} a ${dateTo?fmtD(dateTo):'hoje'} | `
      if (fMach) filterInfo += `Máquina: ${machines.find(m=>m.id===fMach)?.name||''} | `
      if (fUser) filterInfo += `Responsável: ${users.find(u=>u.id===fUser)?.display_name||''}`
      if (filterInfo) {
        doc.setTextColor(245,158,11); doc.setFontSize(7)
        doc.text(filterInfo.slice(0,-3), 12, 22)
      }

      const startY = filterInfo ? 32 : 30

      // addTable: título + tabela padrão + salvar PDF (usada pelos módulos simples,
      // de uma tabela só). Faltava esta definição — os 7 módulos que a chamavam
      // (oee, wood, sales, epi, training, audit, energy) davam erro ao gerar.
      function addTable(doc: any, title: string, head: string[], rows: any[][]) {
        doc.setTextColor(226,232,240); doc.setFontSize(12); doc.setFont('helvetica','bold')
        doc.text(`${title} (${rows.length})`, 12, startY)
        autoTable(doc, {
          startY: startY+5,
          head: [head],
          body: rows,
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`${title.replace(/\s+/g,'')}_${dateStr.replace(/\//g,'-')}.pdf`)
      }

      if (moduleId === 'os') {
        let q = supabase.from('work_orders').select('*').order('created_at',{ascending:false})
        q = buildDateFilter(q, 'created_at')
        if (fMach)   q = q.eq('machine_id', fMach)
        if (fUser)   q = q.eq('resp_id', fUser)
        if (fStatus) q = q.eq('status', fStatus)
        const { data } = await q
        const rows = (data||[]).map((o:any) => [o.number||'—',o.title?.slice(0,30)||'—',o.machine_name||'—',o.resp_name||'—',STATUS_INFO[o.status]?.label||o.status,fmtD(o.open_date),fmtD(o.due_date),o.priority||'—'])
        doc.setTextColor(226,232,240); doc.setFontSize(12); doc.setFont('helvetica','bold')
        doc.text(`Ordens de Serviço (${rows.length})`, 12, startY)
        autoTable(doc, {
          startY: startY+5,
          head: [['Nº OS','Título','Máquina','Responsável','Status','Abertura','Prazo','Prioridade']],
          body: rows,
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`OS_${dateStr.replace(/\//g,'-')}.pdf`)

      } else if (moduleId === 'maint') {
        let q = supabase.from('maintenance').select('*').order('date',{ascending:false})
        if (dateFrom) q = q.gte('date', dateFrom)
        if (dateTo)   q = q.lte('date', dateTo)
        if (fMach)    q = q.eq('machine_id', fMach)
        if (fUser)    q = q.ilike('resp', `%${users.find(u=>u.id===fUser)?.display_name||''}%`)
        const { data } = await q
        const rows = (data||[]).map((r:any) => [fmtD(r.date),r.machine_name||'—',r.type||'—',r.resp||'—',r.duration?r.duration+'h':'—',r.result||'—',r.status||'—'])
        doc.setTextColor(226,232,240); doc.setFontSize(12); doc.setFont('helvetica','bold')
        doc.text(`Histórico de Manutenção (${rows.length})`, 12, startY)
        autoTable(doc, {
          startY: startY+5,
          head: [['Data','Máquina','Tipo','Responsável','Duração','Resultado','Status']],
          body: rows,
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`Manutencao_${dateStr.replace(/\//g,'-')}.pdf`)

      } else if (moduleId === 'pm') {
        let q = supabase.from('pm_reports').select('*').order('date',{ascending:false})
        if (dateFrom) q = q.gte('date', dateFrom)
        if (dateTo)   q = q.lte('date', dateTo)
        if (fMach)    q = q.eq('machine_id', fMach)
        const { data } = await q
        const rows = (data||[]).map((r:any) => [fmtD(r.date),r.machine_name||'—',r.period||'—',r.operator||'—',r.hours_reading||'—',r.status||'—'])
        doc.setTextColor(226,232,240); doc.setFontSize(12); doc.setFont('helvetica','bold')
        doc.text(`Relatórios MP (${rows.length})`, 12, startY)
        autoTable(doc, {
          startY: startY+5,
          head: [['Data','Máquina','Período','Operador','Horímetro','Status']],
          body: rows,
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`MP_${dateStr.replace(/\//g,'-')}.pdf`)

      } else if (moduleId === 'parts') {
        const { data } = await supabase.from('parts').select('*').order('name')
        const rows = (data||[]).map((p:any) => [p.code||'—',p.name||'—',p.category||'—',`${p.stock} ${p.unit}`,p.min_stock,p.unit_value?`R$${p.unit_value}`:'—',p.location||'—',p.stock<=p.min_stock?'⚠️ BAIXO':'OK'])
        doc.setTextColor(226,232,240); doc.setFontSize(12); doc.setFont('helvetica','bold')
        doc.text(`Inventário de Peças (${rows.length})`, 12, startY)
        autoTable(doc, {
          startY: startY+5,
          head: [['Código','Nome','Categoria','Estoque','Mínimo','Valor','Local','Situação']],
          body: rows,
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`Pecas_${dateStr.replace(/\//g,'-')}.pdf`)

      } else if (moduleId === 'po') {
        let q = supabase.from('purchase_orders').select('*').order('created_at',{ascending:false})
        q = buildDateFilter(q)
        if (fStatus) q = q.eq('status', fStatus)
        const { data } = await q
        const rows = (data||[]).map((o:any) => [o.part_name||'—',o.quantity,o.unit_value?`R$${o.unit_value}`:'—',o.status||'—',fmtD(o.date_requested),fmtD(o.date_expected)])
        doc.setTextColor(226,232,240); doc.setFontSize(12); doc.setFont('helvetica','bold')
        doc.text(`Pedidos de Compra (${rows.length})`, 12, startY)
        autoTable(doc, {
          startY: startY+5,
          head: [['Peça','Qtd','Valor Unit.','Status','Solicitado','Previsto']],
          body: rows,
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`PedidosCompra_${dateStr.replace(/\//g,'-')}.pdf`)

      } else if (moduleId === 'finance') {
        let q = supabase.from('accounts_payable').select('*').order('due_date')
        if (dateFrom) q = q.gte('due_date', dateFrom)
        if (dateTo)   q = q.lte('due_date', dateTo)
        if (fStatus)  q = q.eq('status', fStatus)
        const { data } = await q
        const totalPend = (data||[]).filter((b:any)=>b.status==='pending').reduce((s:number,b:any)=>s+(b.valor||0),0)
        const totalPaid = (data||[]).filter((b:any)=>b.status==='paid').reduce((s:number,b:any)=>s+(b.valor||0),0)
        doc.setTextColor(226,232,240); doc.setFontSize(12); doc.setFont('helvetica','bold')
        doc.text(`Contas a Pagar (${(data||[]).length})`, 12, startY)
        doc.setFontSize(9); doc.setTextColor(245,158,11)
        doc.text(`Pendente: R$${totalPend.toFixed(2)} | Pago: R$${totalPaid.toFixed(2)}`, 12, startY+8)
        autoTable(doc, {
          startY: startY+14,
          head: [['Vencimento','Valor','Status','Nº Doc','Pagamento']],
          body: (data||[]).map((b:any) => [fmtD(b.due_date),`R$${Number(b.valor||0).toFixed(2)}`,b.status||'—',b.numero_documento||'—',fmtD(b.data_recebimento)]),
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`Financeiro_${dateStr.replace(/\//g,'-')}.pdf`)

      } else if (moduleId === 'oee') {
        const { data } = await supabase.from('oee_records').select('*').order('record_date',{ascending:false})
        const rows = (data||[]).map((r:any) => {
          const av = r.planned_time>0?(r.operating_time/r.planned_time*100).toFixed(1):0
          const pf = r.operating_time>0?(r.ideal_cycle_time*r.total_pieces/r.operating_time*100).toFixed(1):0
          const ql = r.total_pieces>0?((r.total_pieces-r.defect_pieces)/r.total_pieces*100).toFixed(1):0
          const oee = (parseFloat(String(av))/100*parseFloat(String(pf))/100*parseFloat(String(ql))/100*100).toFixed(1)
          return [r.record_date, r.machine_name, r.shift, `${av}%`, `${pf}%`, `${ql}%`, `${oee}%`, r.notes||'']
        })
        addTable(doc, 'Relatório OEE', ['Data','Máquina','Turno','Disponib.','Perform.','Qualidade','OEE','Obs'], rows)

      } else if (moduleId === 'wood') {
        let q = supabase.from('wood_entries').select('*').order('data_entrada',{ascending:false})
        q = buildDateFilter(q, 'data_entrada')
        const { data } = await q
        const rows = (data||[]).map((r:any) => [fmtD(r.data_entrada), r.supplier_name||'—', r.wood_class||'—', `${r.weight_tons||0} t`, `${r.volume_m3||0} m³`, `R$ ${(r.unit_value||0).toFixed(2)}`, `R$ ${(r.total_value||0).toFixed(2)}`, r.driver||'—', r.plate||'—'])
        addTable(doc, 'Entrada de Madeira', ['Data','Fornecedor','Classe','Peso','Volume','Preço/t','Valor Total','Motorista','Placa'], rows)

      } else if (moduleId === 'sales') {
        let q = supabase.from('sales_orders').select('*').order('sale_date',{ascending:false})
        q = buildDateFilter(q, 'sale_date')
        const { data } = await q
        const rows = (data||[]).map((r:any) => [fmtD(r.sale_date), r.client_name||'—', r.product_name||'—', `${r.weight_tons||0} t`, `R$ ${(r.total_value||0).toFixed(2)}`, r.payment_status==='pago'?'Pago':r.payment_status==='pendente'?'Pendente':'—', r.driver||'—', r.plate||'—', r.invoice||'—'])
        addTable(doc, 'Pedidos de Venda', ['Data','Cliente','Produto','Peso','Valor','Pagamento','Motorista','Placa','NF'], rows)

      } else if (moduleId === 'epi') {
        const { data } = await supabase.from('epi_deliveries').select('*').order('delivery_date',{ascending:false})
        const rows = (data||[]).map((r:any) => [r.delivery_date, r.user_name, r.epi_name, `${r.quantity||1}`, r.validity_date||'', r.notes||''])
        addTable(doc, 'Entregas de EPI', ['Data','Funcionário','EPI','Qtd','Validade','Obs'], rows)

      } else if (moduleId === 'training') {
        const { data } = await supabase.from('trainings').select('*').order('training_date',{ascending:false})
        const rows = (data||[]).map((r:any) => [r.training_date, r.user_name, r.title, r.category||'', r.status, `${r.hours||0}h`, r.expiry_date||''])
        addTable(doc, 'Treinamentos', ['Data','Funcionário','Treinamento','Categoria','Status','Horas','Validade'], rows)

      } else if (moduleId === 'audit') {
        const { data } = await supabase.from('audits').select('*').order('audit_date',{ascending:false})
        const rows = (data||[]).map((r:any) => [r.audit_date, r.title||r.type||'', r.machine_name||'Geral', r.auditor||'', `${r.score||0}%`, `${r.passed_items||0}/${r.total_items||0}`, r.status||''])
        addTable(doc, 'Auditorias', ['Data','Título','Máquina','Auditor','Score','Itens OK','Status'], rows)

      } else if (moduleId === 'energy') {
        const { data } = await supabase.from('energy_records').select('*').order('record_date',{ascending:false})
        const rows = (data||[]).map((r:any) => [r.record_date, r.source, r.sector||'Geral', `${r.reading||0} ${r.unit||'kWh'}`, `R$ ${(r.cost||0).toFixed(2)}`, r.notes||''])
        addTable(doc, 'Consumo de Energia', ['Data','Fonte','Setor','Leitura/Consumo','Custo','Obs'], rows)

      } else if (moduleId === 'parceiro') {
        const parceiroNome = parceiros.find((p:any)=>p.id===fParceiro)?.nome_razao || ''
        const nomeUpper = parceiroNome.trim().toUpperCase()

        let qCompras = supabase.from('purchase_tickets').select('*').eq('supplier_name', parceiroNome).order('purchase_date',{ascending:false})
        if (dateFrom) qCompras = qCompras.gte('purchase_date', dateFrom)
        if (dateTo)   qCompras = qCompras.lte('purchase_date', dateTo)
        let qWood = supabase.from('wood_entries').select('*').ilike('supplier_name', parceiroNome).order('data_entrada',{ascending:false})
        if (dateFrom) qWood = qWood.gte('data_entrada', dateFrom)
        if (dateTo)   qWood = qWood.lte('data_entrada', dateTo)
        let qVendas = supabase.from('sales_orders').select('*').ilike('client_name', parceiroNome).eq('status','active').order('sale_date',{ascending:false})
        if (dateFrom) qVendas = qVendas.gte('sale_date', dateFrom)
        if (dateTo)   qVendas = qVendas.lte('sale_date', dateTo)
        let qSaldo = supabase.from('v_saldo_conta_corrente').select('*').eq('parceiro', nomeUpper)

        const [rCompras, rWood, rVendas, rSaldo] = await Promise.all([qCompras, qWood, qVendas, qSaldo])
        // compras: usa tiquete se existir, senão wood_entries (mesma regra da conta corrente)
        const compras = (rCompras.data && rCompras.data.length > 0) ? rCompras.data : (rWood.data||[])
        const vendas  = rVendas.data || []
        const saldo   = (rSaldo.data||[])[0] || null

        doc.setTextColor(226,232,240); doc.setFontSize(14); doc.setFont('helvetica','bold')
        doc.text(`Relatório do Parceiro: ${parceiroNome}`, 12, startY)
        let y = startY + 8

        // ── Seção 1: Compras ──
        doc.setFontSize(11); doc.setTextColor(0,212,255)
        doc.text(`Compras (${compras.length})`, 12, y)
        autoTable(doc, {
          startY: y+3,
          head: [['Data','Peso (t)','Valor']],
          body: compras.map((c:any)=>[fmtD(c.purchase_date||c.data_entrada), `${c.weight_tons||0}`, `R$ ${(c.total_value||0).toFixed(2)}`]),
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        y = (doc as any).lastAutoTable.finalY + 10

        // ── Seção 2: Vendas ──
        if (y > 250) { doc.addPage(); y = 20 }
        doc.setFontSize(11); doc.setTextColor(0,212,255)
        doc.text(`Vendas (${vendas.length})`, 12, y)
        autoTable(doc, {
          startY: y+3,
          head: [['Data','Produto','Peso (t)','Valor','Motorista','Placa']],
          body: vendas.map((v:any)=>[fmtD(v.sale_date), v.product_name||'—', `${v.weight_tons||0}`, `R$ ${(v.total_value||0).toFixed(2)}`, v.driver||'—', v.plate||'—']),
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        y = (doc as any).lastAutoTable.finalY + 10

        // ── Seção 3: Saldo ──
        if (y > 250) { doc.addPage(); y = 20 }
        doc.setFontSize(11); doc.setTextColor(0,212,255)
        doc.text('Saldo da Conta Corrente', 12, y)
        y += 5
        doc.setFontSize(9); doc.setTextColor(226,232,240)
        if (saldo) {
          const linhas = [
            `Total Compras: R$ ${(+saldo.total_compras||0).toFixed(2)}`,
            `Total Vendas: R$ ${(+saldo.total_vendas||0).toFixed(2)}`,
            `Recebido: R$ ${(+saldo.total_recebido||0).toFixed(2)}  |  Pago: R$ ${(+saldo.total_pago||0).toFixed(2)}`,
            `Créditos: R$ ${(+saldo.total_creditos||0).toFixed(2)}  |  Débitos: R$ ${(+saldo.total_debitos||0).toFixed(2)}`,
          ]
          linhas.forEach(l => { doc.text(l, 12, y); y += 5 })
          doc.setFont('helvetica','bold'); doc.setFontSize(11)
          doc.setTextColor(saldo.saldo_final>=0?34:239, saldo.saldo_final>=0?197:68, saldo.saldo_final>=0?94:68)
          doc.text(`SALDO: R$ ${(+saldo.saldo_final||0).toFixed(2)} (${saldo.situacao})`, 12, y)
          y += 10
        } else {
          doc.text('Sem movimentação de conta corrente para este parceiro.', 12, y)
          y += 10
        }

        // ── Seção 4: Viagens por motorista, agrupadas por tipo ──
        if (y > 250) { doc.addPage(); y = 20 }
        doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(0,212,255)
        doc.text('Viagens por Motorista', 12, y)
        // chave = "motorista||tipo" — tipo é "MADEIRA {fornecedor}" para compras
        // ou o nome do produto para vendas (ex: LAMINA, ROLETE)
        const viagens: Record<string,{motorista:string,tipo:string,qtd:number,peso:number}> = {}
        function addViagem(mot: string, tipo: string, peso: number) {
          const key = `${mot}||${tipo}`
          if (!viagens[key]) viagens[key] = {motorista:mot, tipo, qtd:0, peso:0}
          viagens[key].qtd += 1
          viagens[key].peso += peso
        }
        compras.forEach((r:any) => {
          addViagem(r.driver || 'Não informado', `MADEIRA ${parceiroNome.toUpperCase()}`, +r.weight_tons || 0)
        })
        vendas.forEach((r:any) => {
          addViagem(r.driver || 'Não informado', (r.product_name || 'PRODUTO NÃO INFORMADO').toUpperCase(), +r.weight_tons || 0)
        })
        const linhasViagem = Object.values(viagens).sort((a,b) => a.motorista.localeCompare(b.motorista) || a.tipo.localeCompare(b.tipo))
        autoTable(doc, {
          startY: y+3,
          head: [['Motorista','Tipo de Viagem','Viagens','Peso Total (t)']],
          body: linhasViagem.map(v => [v.motorista, v.tipo, `${v.qtd}`, `${v.peso.toFixed(1)}`]),
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`Parceiro_${parceiroNome.replace(/\s+/g,'')}_${dateStr.replace(/\//g,'-')}.pdf`)

      } else if (moduleId === 'financeiro_completo') {
        let qPag = supabase.from('accounts_payable').select('*, cost_centers(codigo,descricao)').order('due_date',{ascending:false})
        if (dateFrom) qPag = qPag.gte('due_date', dateFrom)
        if (dateTo)   qPag = qPag.lte('due_date', dateTo)
        const [rPag, rCentros] = await Promise.all([
          qPag,
          supabase.from('cost_centers').select('*').eq('active', true).order('codigo'),
        ])
        const pagamentos = rPag.data || []
        const centros = rCentros.data || []

        doc.setTextColor(226,232,240); doc.setFontSize(14); doc.setFont('helvetica','bold')
        doc.text('Relatório Financeiro Completo', 12, startY)
        let y = startY + 8

        // ── Seção 1: Pagamentos do período ──
        const totalPend = pagamentos.filter((p:any)=>p.status==='pending').reduce((s:number,p:any)=>s+(+p.valor||0),0)
        const totalPaid = pagamentos.filter((p:any)=>p.status==='paid').reduce((s:number,p:any)=>s+(+p.valor||0),0)
        doc.setFontSize(11); doc.setTextColor(0,212,255)
        doc.text(`Pagamentos do Período (${pagamentos.length})`, 12, y)
        doc.setFontSize(8); doc.setTextColor(245,158,11)
        doc.text(`Pendente: R$ ${totalPend.toFixed(2)}  |  Pago: R$ ${totalPaid.toFixed(2)}`, 12, y+5)
        autoTable(doc, {
          startY: y+9,
          head: [['Vencimento','Descrição','Centro de Custo','Valor','Status']],
          body: pagamentos.map((p:any) => [fmtD(p.due_date), p.descricao||'—', p.cost_centers ? `${p.cost_centers.codigo} - ${p.cost_centers.descricao}` : '—', `R$ ${(+p.valor||0).toFixed(2)}`, p.status==='paid'?'Pago':p.status==='pending'?'Pendente':p.status==='overdue'?'Vencido':p.status||'—']),
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        y = (doc as any).lastAutoTable.finalY + 10

        // ── Seção 2: Resumo por Centro de Custo ──
        if (y > 240) { doc.addPage(); y = 20 }
        doc.setFontSize(11); doc.setTextColor(0,212,255)
        doc.text('Resumo por Centro de Custo', 12, y)
        const porCentro = centros.map((c:any) => {
          const doCC = pagamentos.filter((p:any)=>p.centro_custo_id===c.id)
          return {
            codigo: c.codigo, descricao: c.descricao, grupo: c.grupo||'—',
            qtd: doCC.length,
            total: doCC.reduce((s:number,p:any)=>s+(+p.valor||0),0),
          }
        }).filter((c:any)=>c.qtd>0)
        autoTable(doc, {
          startY: y+3,
          head: [['Código','Descrição','Grupo','Qtd. Lançamentos','Total']],
          body: porCentro.map((c:any)=>[c.codigo, c.descricao, c.grupo, `${c.qtd}`, `R$ ${c.total.toFixed(2)}`]),
          styles: { fontSize:7, cellPadding:2 },
          headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
          alternateRowStyles: { fillColor:[241,245,249] },
        })
        doc.save(`FinanceiroCompleto_${dateStr.replace(/\//g,'-')}.pdf`)

      } else if (moduleId === 'backup') {
        const tables = ['work_orders','maintenance','machines','parts','pm_reports','tasks','accounts_payable','purchase_orders','stock_movements','suppliers','downtime_records','repair_orders','oee_records','wood_entries','sales_orders','epi_items','epi_deliveries','trainings','audits','energy_records','scheduling','documents','chat_messages']
        const result: any = { _date: new Date().toISOString(), _version: '4.0' }
        for (const t of tables) {
          const { data } = await supabase.from(t).select('*')
          result[t] = data || []
        }
        const blob = new Blob([JSON.stringify(result,null,2)], {type:'application/json'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href=url; a.download=`backup_agendapro_${dateStr.replace(/\//g,'-')}.json`; a.click()
        URL.revokeObjectURL(url)
        toast.success('Backup exportado ✅'); setGen(''); return
      }

      toast.success('PDF gerado! ✅')
    } catch(e:any) { toast.error('Erro: '+e.message) }
    setGen('')
  }

  return (
    <div>
      {/* Filters */}
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        <div className="text-xs font-bold mb-2" style={{color:'var(--cy)'}}>🔍 Filtros para Relatórios</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input label="Data Inicial" value={dateFrom} onChange={setDateFrom} type="date" className="mb-0" />
          <Input label="Data Final" value={dateTo} onChange={setDateTo} type="date" className="mb-0" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{color:'var(--t2)'}}>Máquina</label>
            <select value={fMach} onChange={e=>setFMach(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
              <option value="">Todas</option>
              {machines.map(m=><option key={m.id} value={m.id}>{m.icon||'⚙️'} {m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{color:'var(--t2)'}}>Operador</label>
            <select value={fUser} onChange={e=>setFUser(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
              <option value="">Todos</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.display_name||u.email}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{color:'var(--t2)'}}>Parceiro (cliente/fornecedor) — usado no relatório 🤝</label>
          <select value={fParceiro} onChange={e=>setFParceiro(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif',WebkitAppearance:'none'}}>
            <option value="">Selecione um parceiro...</option>
            {parceiros.map(p=><option key={p.id} value={p.id}>{p.nome_razao}</option>)}
          </select>
        </div>
        {(dateFrom||dateTo||fMach||fUser||fParceiro)&&(
          <button onClick={()=>{setDateFrom('');setDateTo('');setFMach('');setFUser('');setFStatus('');setFParceiro('')}} className="mt-2 text-xs px-3 py-1 rounded-lg" style={{background:'var(--s2)',color:'var(--t2)',border:'1px solid var(--bd)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif'}}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* KPIs */}
      <SH label="Resumo Geral" />
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {[
          {l:'OS Abertas',   v:summary.osOpen||0,    c:'var(--cy)'},
          {l:'OS Concluídas',v:summary.osDone||0,    c:'var(--gn)'},
          {l:'Manutenções',  v:summary.maintTotal||0, c:'var(--am)'},
          {l:'Peças Baixo',  v:summary.partsLow||0,  c:summary.partsLow>0?'var(--rd)':'var(--gn)'},
        ].map(k=>(
          <div key={k.l} className="rounded-xl p-2 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div className="absolute top-0 inset-x-0 h-0.5" style={{background:k.c}}/>
            <div className="font-bebas text-2xl" style={{color:k.c}}>{k.v}</div>
            <div style={{fontSize:'7px',color:'var(--t3)',textTransform:'uppercase'}}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Report cards */}
      <SH label="Gerar Relatórios" />
      <div className="grid grid-cols-2 gap-2">
        {REPORT_MODULES.map(r=>(
          <div key={r.id} onClick={()=>generating?null:generate(r.id)}
            className="rounded-xl p-3 cursor-pointer flex flex-col transition-all"
            style={{background:'var(--s1)',border:`1px solid ${generating===r.id?'var(--cy)':'var(--bd)'}`,opacity:generating&&generating!==r.id?.3:1}}
            onMouseEnter={e=>{if(!generating){(e.currentTarget as HTMLElement).style.borderColor='var(--cy)';(e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=generating===r.id?'var(--cy)':'var(--bd)';(e.currentTarget as HTMLElement).style.transform='none'}}>
            <div className="text-2xl mb-1">{generating===r.id?'⏳':r.icon}</div>
            <div className="text-xs font-bold leading-tight">{r.title}</div>
            <div className="text-xs mt-1 flex-1" style={{color:'var(--t2)',lineHeight:1.4}}>{r.desc}</div>
            <div className="mt-2 self-start px-2 py-0.5 rounded-lg text-xs font-bold" style={{background:r.id==='backup'?'rgba(16,185,129,.15)':'rgba(0,212,255,.12)',color:r.id==='backup'?'var(--gn)':'var(--cy)'}}>
              {generating===r.id?'Gerando...' : r.id==='backup'?'JSON':'PDF'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
