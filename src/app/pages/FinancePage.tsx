'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SelectComCadastro, Textarea, SH, Empty, Badge, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const STATUS_OPTS = [{value:'pending',label:'⏳ Pendente'},{value:'paid',label:'✅ Pago'},{value:'overdue',label:'🔴 Vencido'},{value:'cancelled',label:'⚫ Cancelado'}]
const STATUS_COLOR: Record<string,string> = {pending:'amber',paid:'green',overdue:'red',cancelled:'gray'}
const STATUS_LABEL: Record<string,string> = {pending:'Pendente',paid:'Pago',overdue:'Vencido',cancelled:'Cancelado'}

export default function FinancePage({ profile, can }: Props) {
  const [bills, setBills]       = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [centers, setCenters]   = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoad]      = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEdit]      = useState<any>({})
  const [tab, setTab]           = useState('bills')
  const [opModal, setOpModal]   = useState(false)
  const [op, setOp]             = useState<any>({})
  const [fixed, setFixed]       = useState<any[]>([])
  const [fixModal, setFixModal] = useState(false)
  const [editFix, setEditFix]   = useState<any>({})
  const [fStatus, setFStatus]   = useState('')
  const [search, setSearch]     = useState('')
  const [relFrom, setRelFrom]   = useState('')
  const [relTo, setRelTo]       = useState('')
  const [gerando, setGerando]   = useState(false)
  const [relCentro, setRelCentro] = useState('')
  const [relMaquina, setRelMaquina] = useState('')
  const [relResult, setRelResult] = useState<any>(null)
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load() }, [tab])

  async function load() {
    if (tab === 'bills') {
      const [b, c, s, m] = await Promise.all([
        supabase.from('accounts_payable').select('*').order('created_at',{ascending:false}),
        supabase.from('cost_centers').select('*').eq('active', true),
        supabase.from('cadastros').select('id,nome_razao,nome_fantasia').eq('is_fornecedor',true).eq('status',true),
        supabase.from('machines').select('id,code,name').order('name'),
      ])
      setBills(b.data||[]); setCenters(c.data||[]); setSuppliers(s.data||[]); setMachines(m.data||[])
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
    if (saving) return
    setSaving(true)
    if (!editFix.description?.trim()) { toast.error('Informe a descrição'); setSaving(false); return }
    if (!editFix.value) { toast.error('Informe o valor'); setSaving(false); return }
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
    if (error) { toast.error('Erro: '+error.message); setSaving(false); return }
    setSaving(false)
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

  function imprimirOrdemPagamento(dados: any) {
    const esc = (s:any) => String(s==null?'':s).replace(/[&<>"']/g, (c:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
    const fmtR = (v:any) => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
    const fmtD2 = (d:string) => d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR') : '—'
    const linha = (l:string,v:string) => `<tr><td style="padding:8px 12px;color:#555;border-bottom:1px solid #ddd;width:35%">${esc(l)}</td><td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #ddd">${esc(v)}</td></tr>`
    const html = `
      <html><head><title>Ordem de Pagamento</title></head>
      <body style="font-family:Arial,sans-serif;max-width:640px;margin:20px auto;color:#111">
        <div style="background:#060d1a;color:#fff;padding:18px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;color:#f97316">ORDEM DE PAGAMENTO</h2>
          <div style="font-size:12px;color:#ccc">Pagamento avulso (sem nota fiscal) · Emitido em ${new Date().toLocaleString('pt-BR')}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #ddd">
          ${linha('Fornecedor / Beneficiário', dados.nomeF)}
          ${linha('Valor a pagar', fmtR(dados.valor))}
          ${linha('Chave PIX', dados.pix || '—')}
          ${linha('Data para pagamento', fmtD2(dados.due_date))}
          ${linha('Centro de Custo', dados.centro || '—')}
          ${linha('Descrição / Referência', dados.descricao || '—')}
          ${linha('Solicitado por', dados.solicitante || '—')}
        </table>
        <div style="margin-top:50px;display:flex;justify-content:space-around;font-size:12px;text-align:center">
          <div>_____________________________<br>Solicitante</div>
          <div>_____________________________<br>Autorização / Financeiro</div>
        </div>
        <div style="margin-top:40px;font-size:10px;color:#888;text-align:center">
          Este documento autoriza o pagamento acima descrito. Confira os dados antes de efetuar.
        </div>
      </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(), 300) }
  }

  async function salvarOrdemPagamento() {
    if (saving) return
    if (!op.fornecedor_id) { toast.error('Selecione o fornecedor'); return }
    if (!op.valor || parseFloat(String(op.valor)) <= 0) { toast.error('Informe o valor'); return }
    if (!op.due_date) { toast.error('Informe a data de pagamento'); return }
    setSaving(true)
    try {
      const sup = suppliers.find((s:any)=>s.id===op.fornecedor_id)
      const nomeF = sup ? (sup.nome_razao||sup.nome_fantasia) : ''
      const obs = op.pix ? `PIX: ${op.pix}` : ''
      const obj = {
        fornecedor_id: op.fornecedor_id,
        valor: parseFloat(String(op.valor)),
        due_date: op.due_date,
        data_emissao: td(),
        descricao: op.descricao || `Ordem de pagamento — ${nomeF}`,
        observacao: obs,
        centro_custo_id: op.centro_custo_id || null,
        status: 'pending',
        created_by: profile?.display_name||profile?.email,
        created_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('accounts_payable').insert(obj)
      if (error) throw error
      toast.success('Ordem de pagamento lançada no Financeiro ✅')
      // Imprime automaticamente ao salvar
      const cc = centers.find((x:any)=>x.id===op.centro_custo_id)
      const nomeCentro = cc ? `${cc.codigo} - ${cc.descricao}` : '—'
      imprimirOrdemPagamento({ nomeF, valor: obj.valor, pix: op.pix, due_date: op.due_date, descricao: op.descricao, centro: nomeCentro, solicitante: profile?.display_name||profile?.email })
      setOpModal(false); setOp({}); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
    finally { setSaving(false) }
  }

  async function saveBill() {
    if (saving) return
    setSaving(true)
    if (!editing.fornecedor_id) { toast.error('Selecione o fornecedor'); setSaving(false); return }
    if (!editing.valor)         { toast.error('Informe o valor'); setSaving(false); return }
    try {
      const obj = { ...editing, created_by: profile?.display_name||profile?.email, created_at: new Date().toISOString() }
      if (editing.id) {
        const { error } = await supabase.from('accounts_payable').update(obj).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('accounts_payable').insert(obj)
        if (error) throw error
      }
      setSaving(false)
      toast.success('Salvo ✅'); setModal(false); load()
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function saveCenter() {
    if (saving) return
    setSaving(true)
    if (!editing.descricao) { toast.error('Informe a descrição'); setSaving(false); return }
    try {
      const obj = { ...editing, active: true }
      if (editing.id) {
        const { error: eCc } = await supabase.from('cost_centers').update(obj).eq('id', editing.id)
        if (eCc) { toast.error('Erro: '+eCc.message); setSaving(false); return }
      } else {
        const { error: eCc2 } = await supabase.from('cost_centers').insert(obj)
        if (eCc2) { toast.error('Erro: '+eCc2.message); setSaving(false); return }
      }
      setSaving(false)
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
    const center = centers.find(c=>c.id===b.centro_custo_id)
    const q = search.toLowerCase()
    if (fStatus && b.status !== fStatus) return false
    if (!q) return true
    const campos = [
      sup?.nome_razao, b.numero_documento, b.descricao, b.valor,
      b.due_date, b.data_emissao, b.data_recebimento, b.status,
      center?.codigo, center?.descricao
    ].map(x => (x===null||x===undefined) ? '' : String(x).toLowerCase())
    return campos.some(c => c.includes(q))
  })


  // Calcula os dados do relatorio (compartilhado: tela, PDF, impressao)
  async function calcularRelatorio() {
    let q = supabase.from('accounts_payable').select('*').order('due_date',{ascending:true})
    if (relFrom) q = q.gte('due_date', relFrom)
    if (relTo)   q = q.lte('due_date', relTo)
    if (relCentro) q = q.eq('centro_custo_id', relCentro)
    if (relMaquina) q = q.eq('machine_id', relMaquina)
    const { data: contas } = await q
    let rows = contas || []

    const nomeForn = (id:string) => { const s = suppliers.find((x:any)=>x.id===id); return s ? (s.nome_razao||s.nome_fantasia) : '—' }
    const nomeCentro = (id:string) => { const c = centers.find((x:any)=>x.id===id); return c ? `${c.codigo} - ${c.descricao}` : '—' }
    const nomeMaquina = (id:string) => { const m = machines.find((x:any)=>x.id===id); return m ? ((m.code?m.code+' - ':'')+m.name) : null }
    const stLabel = (s:string) => s==='paid'?'Pago':s==='pending'?'Pendente':s==='overdue'?'Vencido':s==='cancelled'?'Cancelado':(s||'—')

    const lista = rows.map((b:any)=>({
      due_date: b.due_date, forn: nomeForn(b.fornecedor_id), descricao: b.descricao||'—',
      centro: nomeCentro(b.centro_custo_id), maquina: nomeMaquina(b.machine_id)||'—',
      valor: Number(b.valor)||0, status: stLabel(b.status)
    }))
    const total = lista.reduce((s:number,b:any)=>s+b.valor,0)

    const porCentro:any = {}
    rows.forEach((b:any)=>{ const k=nomeCentro(b.centro_custo_id); if(!porCentro[k]) porCentro[k]={qtd:0,val:0}; porCentro[k].qtd++; porCentro[k].val+=Number(b.valor)||0 })
    const centroRows = Object.keys(porCentro).map(k=>({nome:k,qtd:porCentro[k].qtd,val:porCentro[k].val})).sort((a:any,b:any)=>b.val-a.val)

    const porMaquina:any = {}
    rows.forEach((b:any)=>{ const nm=nomeMaquina(b.machine_id); if(nm){ if(!porMaquina[nm]) porMaquina[nm]={qtd:0,val:0}; porMaquina[nm].qtd++; porMaquina[nm].val+=Number(b.valor)||0 } })
    const maqRows = Object.keys(porMaquina).map(k=>({nome:k,qtd:porMaquina[k].qtd,val:porMaquina[k].val})).sort((a:any,b:any)=>b.val-a.val)

    return { lista, total, centroRows, maqRows }
  }

  const moneyBR = (v:any) => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
  const fmtDataBR = (d:string) => d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR') : '—'

  // Ver na tela
  async function verRelatorio() {
    if (gerando) return
    setGerando(true)
    try {
      const r = await calcularRelatorio()
      setRelResult(r)
    } catch (err:any) { toast.error('Erro: ' + (err?.message||err)) }
    finally { setGerando(false) }
  }

  // Baixar PDF
  async function gerarRelatorioFinanceiro() {
    if (gerando) return
    setGerando(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const r = await calcularRelatorio()
      const doc = new jsPDF()
      doc.setFillColor(6,13,26); doc.rect(0,0,210,24,'F')
      doc.setTextColor(249,115,22); doc.setFontSize(15); doc.setFont('helvetica','bold')
      doc.text('Industrial8 — Relatorio Financeiro', 12, 11)
      doc.setTextColor(200,200,200); doc.setFontSize(9); doc.setFont('helvetica','normal')
      const periodo = (relFrom||relTo) ? `Periodo: ${relFrom?fmtDataBR(relFrom):'inicio'} a ${relTo?fmtDataBR(relTo):'hoje'}` : 'Todos os lancamentos'
      doc.text(periodo + ' | Gerado em ' + new Date().toLocaleDateString('pt-BR'), 12, 18)
      autoTable(doc, {
        startY: 30,
        head: [['Vencimento','Fornecedor','Descricao','Centro de Custo','Maquina','Valor','Status']],
        body: r.lista.map((b:any)=>[fmtDataBR(b.due_date), b.forn, b.descricao, b.centro, b.maquina, moneyBR(b.valor), b.status]),
        foot: [['TOTAL','','','','', moneyBR(r.total),'']],
        theme:'striped', styles:{fontSize:7}, headStyles:{fillColor:[30,58,110],textColor:[255,255,255]},
        footStyles:{fillColor:[30,58,110],textColor:[255,255,255],fontStyle:'bold'},
      })
      let y = (doc as any).lastAutoTable.finalY + 10
      if (r.centroRows.length>0) {
        if (y>250){doc.addPage();y=20}
        doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(0,0,0)
        doc.text('Resumo por Centro de Custo', 12, y)
        autoTable(doc, { startY:y+3, head:[['Centro de Custo','Qtd','Total']], body:r.centroRows.map((c:any)=>[c.nome,String(c.qtd),moneyBR(c.val)]), theme:'grid', styles:{fontSize:8}, headStyles:{fillColor:[59,130,246]} })
        y = (doc as any).lastAutoTable.finalY + 10
      }
      if (r.maqRows.length>0) {
        if (y>250){doc.addPage();y=20}
        doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(0,0,0)
        doc.text('Custo por Maquina', 12, y)
        autoTable(doc, { startY:y+3, head:[['Maquina','Qtd','Total']], body:r.maqRows.map((m:any)=>[m.nome,String(m.qtd),moneyBR(m.val)]), theme:'grid', styles:{fontSize:8}, headStyles:{fillColor:[34,197,94]} })
      }
      doc.save(`financeiro_${new Date().toISOString().slice(0,10)}.pdf`)
      toast.success('Relatorio gerado')
    } catch (err:any) { toast.error('Erro ao gerar: ' + (err?.message||err)) }
    finally { setGerando(false) }
  }

  // Imprimir
  async function imprimirRelatorio() {
    if (gerando) return
    setGerando(true)
    try {
      const r = await calcularRelatorio()
      const periodo = (relFrom||relTo) ? `Periodo: ${relFrom?fmtDataBR(relFrom):'inicio'} a ${relTo?fmtDataBR(relTo):'hoje'}` : 'Todos os lancamentos'
      const th='padding:6px 8px;background:#1e3a6e;color:#fff;font-size:11px;text-align:left'
      const td2='padding:5px 8px;border-bottom:1px solid #ddd;font-size:11px'
      const esc = (s:any) => String(s==null?'':s).replace(/[&<>"']/g, (c:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
      const linhas = r.lista.map((b:any)=>`<tr><td style="${td2}">${fmtDataBR(b.due_date)}</td><td style="${td2}">${esc(b.forn)}</td><td style="${td2}">${esc(b.descricao)}</td><td style="${td2}">${esc(b.centro)}</td><td style="${td2}">${esc(b.maquina)}</td><td style="${td2};text-align:right">${moneyBR(b.valor)}</td><td style="${td2}">${esc(b.status)}</td></tr>`).join('')
      const centroLinhas = r.centroRows.map((c:any)=>`<tr><td style="${td2}">${esc(c.nome)}</td><td style="${td2}">${c.qtd}</td><td style="${td2};text-align:right">${moneyBR(c.val)}</td></tr>`).join('')
      const maqLinhas = r.maqRows.map((m:any)=>`<tr><td style="${td2}">${esc(m.nome)}</td><td style="${td2}">${m.qtd}</td><td style="${td2};text-align:right">${moneyBR(m.val)}</td></tr>`).join('')
      const html = `<html><head><title>Relatorio Financeiro</title></head><body style="font-family:Arial,sans-serif;max-width:800px;margin:20px auto;color:#111">
        <div style="background:#060d1a;color:#fff;padding:16px;border-radius:8px 8px 0 0"><h2 style="margin:0;color:#f97316">Industrial8 — Relatorio Financeiro</h2><div style="font-size:12px;color:#ccc">${periodo} · Impresso em ${new Date().toLocaleString('pt-BR')}</div></div>
        <table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr><th style="${th}">Vencimento</th><th style="${th}">Fornecedor</th><th style="${th}">Descricao</th><th style="${th}">Centro</th><th style="${th}">Maquina</th><th style="${th};text-align:right">Valor</th><th style="${th}">Status</th></tr></thead><tbody>${linhas}<tr><td colspan="5" style="${td2};font-weight:bold;text-align:right">TOTAL</td><td style="${td2};font-weight:bold;text-align:right">${moneyBR(r.total)}</td><td></td></tr></tbody></table>
        ${r.centroRows.length? `<h3 style="margin-top:24px;color:#3b82f6">Resumo por Centro de Custo</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="${th}">Centro de Custo</th><th style="${th}">Qtd</th><th style="${th};text-align:right">Total</th></tr></thead><tbody>${centroLinhas}</tbody></table>`:''}
        ${r.maqRows.length? `<h3 style="margin-top:24px;color:#22c55e">Custo por Maquina</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="${th}">Maquina</th><th style="${th}">Qtd</th><th style="${th};text-align:right">Total</th></tr></thead><tbody>${maqLinhas}</tbody></table>`:''}
      </body></html>`
      const w = window.open('','_blank')
      if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),300) }
    } catch (err:any) { toast.error('Erro: ' + (err?.message||err)) }
    finally { setGerando(false) }
  }

  return (
    <div>
      {dialog}
      {/* Tabs */}
      <div className="flex gap-1.5 mb-3">
        {[{k:'bills',l:'💰 Contas'},{k:'fixed',l:'🔁 Fixas'},{k:'centers',l:'📊 Centros'},{k:'relatorios',l:'📄 Relatórios'}].map(t=>(
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
            footer={<><Btn onClick={()=>setFixModal(false)}>Cancelar</Btn><Btn onClick={saveFixed} variant="primary" size="md" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn></>}>
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
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar por fornecedor, nº doc, descrição, valor, data, centro de custo..."
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
              style={{background:'var(--s1)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}}
              onFocus={e=>e.target.style.borderColor='var(--cy)'} onBlur={e=>e.target.style.borderColor='var(--bd)'} />
            {can('admin')&&<Btn onClick={()=>{setEdit({status:'pending',data_emissao:td()});setModal(true)}} size="sm" variant="primary">+ Nova</Btn>}
            {can('admin')&&<Btn onClick={()=>{setOp({due_date:td()});setOpModal(true)}} size="sm" variant="secondary">💸 Ordem de Pagamento</Btn>}
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
          <Modal open={opModal} onClose={()=>setOpModal(false)} title="💸 Ordem de Pagamento"
            footer={<><Btn onClick={()=>setOpModal(false)}>Cancelar</Btn><Btn onClick={salvarOrdemPagamento} variant="primary" size="md" disabled={saving}>{saving?'Salvando...':'Salvar e Imprimir'}</Btn></>}>
            <div style={{fontSize:'11px',color:'var(--t3)',marginBottom:'10px'}}>Pagamento avulso (sem NF). Ao salvar, lança no Financeiro e abre a impressão.</div>
            <SelectComCadastro label="Fornecedor / Beneficiário *" tipo="fornecedor" value={op.fornecedor_id||''} onChange={(v:string)=>setOp((e:any)=>({...e,fornecedor_id:v}))}
              options={suppliers.map((s:any)=>({value:s.id,label:s.nome_razao||s.nome_fantasia}))}
              companyId={profile?.company_id} createdBy={profile?.display_name} onCreatedRefresh={()=>load()} />
            <div className="grid grid-cols-2 gap-x-3">
              <Input label="Valor R$ *" type="number" value={op.valor||''} onChange={(v:string)=>setOp((e:any)=>({...e,valor:v}))} placeholder="0.00" />
              <Input label="Data de Pagamento *" type="date" value={op.due_date||''} onChange={(v:string)=>setOp((e:any)=>({...e,due_date:v}))} />
            </div>
            <Input label="Chave PIX" value={op.pix||''} onChange={(v:string)=>setOp((e:any)=>({...e,pix:v}))} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
            <Input label="Descrição / Referência" value={op.descricao||''} onChange={(v:string)=>setOp((e:any)=>({...e,descricao:v}))} placeholder="Motivo do pagamento" />
            <Select label="Centro de Custo" value={op.centro_custo_id||''} onChange={(v:string)=>setOp((e:any)=>({...e,centro_custo_id:v}))} options={[{value:'',label:'Selecione...'}, ...centers.map((c:any)=>({value:c.id,label:`${c.codigo} - ${c.descricao}`}))]} />
          </Modal>

          <Modal open={modal&&tab==='bills'} onClose={()=>setModal(false)} title={editing.id?'Editar Conta':'Nova Conta a Pagar'}
            footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveBill} variant="primary" size="md" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn></>}>
            <SelectComCadastro label="Fornecedor *" tipo="fornecedor" value={editing.fornecedor_id||''} onChange={(v:string)=>setEdit((e:any)=>({...e,fornecedor_id:v}))}
              options={suppliers.map(s=>({value:s.id,label:s.nome_razao||s.nome_fantasia}))}
              companyId={profile?.company_id} createdBy={profile?.display_name} onCreatedRefresh={() => load()} />
            <Select label="Centro de Custo" value={editing.centro_custo_id} onChange={(v:string)=>setEdit((e:any)=>({...e,centro_custo_id:v}))}
              options={[{value:'',label:'Nenhum'},...centers.map(c=>({value:c.id,label:`${c.codigo} - ${c.descricao}`}))]} />
            <Select label="Maquina (opcional)" value={editing.machine_id||''} onChange={(v:string)=>setEdit((e:any)=>({...e,machine_id:v||null}))} options={[{value:'',label:'Nenhuma'},...machines.map(mq=>({value:mq.id,label:(mq.code?mq.code+' - ':'')+mq.name}))]} />
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
            footer={<><Btn onClick={()=>setModal(false)} variant="secondary" size="md">Cancelar</Btn><Btn onClick={saveCenter} variant="primary" size="md" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn></>}>
            <div className="grid grid-cols-2 gap-x-2">
              <Input label="Código" value={editing.codigo} onChange={(v:string)=>setEdit((e:any)=>({...e,codigo:v}))} placeholder="CC-001" />
              <Input label="Grupo" value={editing.grupo} onChange={(v:string)=>setEdit((e:any)=>({...e,grupo:v}))} placeholder="Produção" />
            </div>
            <Input label="Descrição *" value={editing.descricao} onChange={(v:string)=>setEdit((e:any)=>({...e,descricao:v}))} placeholder="Manutenção Geral" />
          </Modal>
        </>
      )}
      {tab==='relatorios' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl p-4" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'var(--t1)',marginBottom:'10px'}}>📄 Relatório Financeiro</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input label="Data inicial" value={relFrom} onChange={(v:string)=>setRelFrom(v)} type="date" />
              <Input label="Data final" value={relTo} onChange={(v:string)=>setRelTo(v)} type="date" />
              <Select label="Centro de Custo" value={relCentro} onChange={(v:string)=>setRelCentro(v)} options={[{value:'',label:'Todos os centros'}, ...centers.map((c:any)=>({value:c.id,label:`${c.codigo} - ${c.descricao}`}))]} />
              <Select label="Máquina" value={relMaquina} onChange={(v:string)=>setRelMaquina(v)} options={[{value:'',label:'Todas as máquinas'}, ...machines.map((m:any)=>({value:m.id,label:(m.code?m.code+' - ':'')+m.name}))]} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Btn onClick={verRelatorio} variant="primary" size="md" disabled={gerando}>{gerando?'Carregando...':'🔍 Ver na Tela'}</Btn>
              <Btn onClick={imprimirRelatorio} size="md" disabled={gerando}>🖨️ Imprimir</Btn>
              <Btn onClick={gerarRelatorioFinanceiro} size="md" disabled={gerando}>📄 Baixar PDF</Btn>
            </div>
          </div>

          {relResult && (
            <div className="rounded-2xl p-4" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div style={{fontSize:'12px',fontWeight:700,color:'var(--cy)',marginBottom:'8px'}}>Contas do Período ({relResult.lista.length})</div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                  <thead><tr style={{background:'var(--s2)'}}>
                    {['Vencimento','Fornecedor','Descrição','Centro','Máquina','Valor','Status'].map(h=>(
                      <th key={h} style={{padding:'6px 8px',textAlign:'left',color:'var(--t2)',borderBottom:'1px solid var(--bd)'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {relResult.lista.map((b:any,i:number)=>(
                      <tr key={i} style={{borderBottom:'1px solid var(--bd)'}}>
                        <td style={{padding:'5px 8px',color:'var(--t1)'}}>{fmtDataBR(b.due_date)}</td>
                        <td style={{padding:'5px 8px',color:'var(--t1)'}}>{b.forn}</td>
                        <td style={{padding:'5px 8px',color:'var(--t1)'}}>{b.descricao}</td>
                        <td style={{padding:'5px 8px',color:'var(--t3)'}}>{b.centro}</td>
                        <td style={{padding:'5px 8px',color:'var(--t3)'}}>{b.maquina}</td>
                        <td style={{padding:'5px 8px',textAlign:'right',fontWeight:600,color:'var(--t1)'}}>{moneyBR(b.valor)}</td>
                        <td style={{padding:'5px 8px',color:'var(--t2)'}}>{b.status}</td>
                      </tr>
                    ))}
                    <tr style={{background:'var(--s2)',fontWeight:700}}>
                      <td colSpan={5} style={{padding:'6px 8px',textAlign:'right',color:'var(--t1)'}}>TOTAL</td>
                      <td style={{padding:'6px 8px',textAlign:'right',color:'var(--cy)'}}>{moneyBR(relResult.total)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {relResult.centroRows.length>0 && (<>
                <div style={{fontSize:'12px',fontWeight:700,color:'#3b82f6',margin:'16px 0 8px'}}>Resumo por Centro de Custo</div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                  <thead><tr style={{background:'var(--s2)'}}><th style={{padding:'6px 8px',textAlign:'left',color:'var(--t2)'}}>Centro</th><th style={{padding:'6px 8px',textAlign:'left',color:'var(--t2)'}}>Qtd</th><th style={{padding:'6px 8px',textAlign:'right',color:'var(--t2)'}}>Total</th></tr></thead>
                  <tbody>{relResult.centroRows.map((c:any,i:number)=>(<tr key={i} style={{borderBottom:'1px solid var(--bd)'}}><td style={{padding:'5px 8px',color:'var(--t1)'}}>{c.nome}</td><td style={{padding:'5px 8px',color:'var(--t1)'}}>{c.qtd}</td><td style={{padding:'5px 8px',textAlign:'right',color:'var(--t1)'}}>{moneyBR(c.val)}</td></tr>))}</tbody>
                </table>
              </>)}

              {relResult.maqRows.length>0 && (<>
                <div style={{fontSize:'12px',fontWeight:700,color:'#22c55e',margin:'16px 0 8px'}}>Custo por Máquina</div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                  <thead><tr style={{background:'var(--s2)'}}><th style={{padding:'6px 8px',textAlign:'left',color:'var(--t2)'}}>Máquina</th><th style={{padding:'6px 8px',textAlign:'left',color:'var(--t2)'}}>Qtd</th><th style={{padding:'6px 8px',textAlign:'right',color:'var(--t2)'}}>Total</th></tr></thead>
                  <tbody>{relResult.maqRows.map((m:any,i:number)=>(<tr key={i} style={{borderBottom:'1px solid var(--bd)'}}><td style={{padding:'5px 8px',color:'var(--t1)'}}>{m.nome}</td><td style={{padding:'5px 8px',color:'var(--t1)'}}>{m.qtd}</td><td style={{padding:'5px 8px',textAlign:'right',color:'var(--t1)'}}>{moneyBR(m.val)}</td></tr>))}</tbody>
                </table>
              </>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
