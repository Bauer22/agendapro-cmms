'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Input, Select, SH, Empty, KPI, Badge } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }
type Tab = 'custo'|'centros'|'transporte'|'conta'|'vendas'

const money = (v:number) => `R$ ${(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const moneyK = (v:number) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${(v||0).toFixed(0)}`
const n2 = (v:number) => (v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function GerencialPage({ profile, can }: Props) {
  const [tab, setTab] = useState<Tab>('custo')
  const [loading, setLoading] = useState(true)

  // filtro de período
  const [period, setPeriod] = useState<'mes'|'3m'|'ano'|'custom'>('mes')
  const [pFrom, setPFrom] = useState('')
  const [pTo, setPTo]     = useState('')

  const [custos, setCustos]   = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [transp, setTransp]   = useState<any[]>([])
  const [conta, setConta]     = useState<any[]>([])
  const [saldos, setSaldos]   = useState<any[]>([])
  const [vendas, setVendas]   = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // Fecha automaticamente o estoque de madeira do mes atual (atualiza materia-prima)
    // A funcao faz upsert e recalcula sempre; se falhar, apenas segue sem travar o dashboard
    try {
      const mesAtual = new Date().toISOString().slice(0,7)
      await supabase.rpc('fn_fechar_estoque_madeira', { p_mes: mesAtual })
    } catch (e) { /* silencioso: nao impede o carregamento */ }
    const [c, cc, t, k, s, v] = await Promise.all([
      supabase.from('v_custo_m3_mensal').select('*'),
      supabase.from('v_custo_m3_centro').select('*'),
      supabase.from('v_transportadora').select('*'),
      supabase.from('v_conta_corrente').select('*'),
      supabase.from('v_saldo_parceiro').select('*'),
      supabase.from('v_vendas_produto_mes').select('*'),
    ])
    if (c.error) toast.error('Erro custo/m³: '+c.error.message)
    if (cc.error) console.warn('v_custo_m3_centro indisponível:', cc.error.message)
    setCustos(c.data||[]); setCentros(cc.data||[]); setTransp(t.data||[])
    setConta(k.data||[]);  setSaldos(s.data||[]);   setVendas(v.data||[])
    setLoading(false)
  }

  // ── Faixa de meses conforme o filtro ──
  function mesesFiltro(): string[] {
    const now = new Date()
    const ym = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    if (period === 'mes') return [ym(now)]
    if (period === '3m') {
      const out:string[] = []
      for (let i=2;i>=0;i--) { const d=new Date(now.getFullYear(), now.getMonth()-i, 1); out.push(ym(d)) }
      return out
    }
    if (period === 'ano') {
      const out:string[] = []
      for (let m=0;m<12;m++) out.push(`${now.getFullYear()}-${String(m+1).padStart(2,'0')}`)
      return out
    }
    // custom
    if (!pFrom || !pTo) return []
    const out:string[] = []
    const a = new Date(pFrom+'T00:00:00'), b = new Date(pTo+'T00:00:00')
    const d = new Date(a.getFullYear(), a.getMonth(), 1)
    while (d <= b) { out.push(ym(d)); d.setMonth(d.getMonth()+1) }
    return out
  }
  const meses = mesesFiltro()
  const noPeriodo = (m:string) => meses.length === 0 || meses.includes(m)

  // ── Dados filtrados ──
  const fCustos  = custos.filter(x => noPeriodo(x.mes))
  const fCentros = centros.filter(x => noPeriodo(x.mes))
  const fTransp  = transp.filter(x => noPeriodo(x.mes))
  const fConta   = conta.filter(x => noPeriodo(x.mes))
  const fVendas  = vendas.filter(x => noPeriodo(x.mes))

  // ── Consolidado do período (9 categorias da view v_custo_m3_mensal) ──
  const T = {
    m3:            fCustos.reduce((s,x)=>s+(+x.m3_produzido||0),0),
    materiaPrima:  fCustos.reduce((s,x)=>s+(+x.custo_materia_prima||0),0),
    maoObra:       fCustos.reduce((s,x)=>s+(+x.custo_mao_obra||0),0),
    manutencao:    fCustos.reduce((s,x)=>s+(+x.custo_manutencao||0),0),
    energia:       fCustos.reduce((s,x)=>s+(+x.custo_energia||0),0),
    caldeira:      fCustos.reduce((s,x)=>s+(+x.custo_caldeira||0),0),
    combustivel:   fCustos.reduce((s,x)=>s+(+x.custo_combustivel||0),0),
    administrativo:fCustos.reduce((s,x)=>s+(+x.custo_administrativo||0),0),
    maquinas:      fCustos.reduce((s,x)=>s+(+x.custo_maquinas||0),0),
    diversas:      fCustos.reduce((s,x)=>s+(+x.custo_diversas||0),0),
    fixosAdm:      fCustos.reduce((s,x)=>s+(+x.custo_fixos_adm||0),0),
    melhorias:     fCustos.reduce((s,x)=>s+(+x.custo_melhorias||0),0),
  }
  const custoTotal = T.materiaPrima + T.maoObra + T.manutencao + T.energia + T.caldeira + T.combustivel + T.administrativo + T.maquinas + T.diversas + T.fixosAdm + T.melhorias
  // Indicadores extras para o dashboard
  const mesesNoPeriodo = new Set(fCustos.map((x:any)=>x.mes)).size || 1
  const mediaProducao = T.m3 / mesesNoPeriodo                         // média de m³ por mês
  const totalCentros = fCentros.reduce((s:number,c:any)=>s+(+c.valor||0),0)  // soma dos centros de custo
  const custoM3    = T.m3 > 0 ? custoTotal / T.m3 : 0
  const fatTotal   = fVendas.reduce((s,x)=>s+(+x.faturado||0),0)
  const margem     = fatTotal - custoTotal

  // ── Centros agrupados no período ──
  const centrosAgg = (() => {
    const m: Record<string,{centro:string;valor:number}> = {}
    fCentros.forEach(x => {
      const k = x.centro || 'Sem centro'
      if (!m[k]) m[k] = {centro:k, valor:0}
      m[k].valor += +x.valor||0
    })
    return Object.values(m).map(x => ({...x, porM3: T.m3>0 ? x.valor/T.m3 : 0}))
      .sort((a,b)=>b.valor-a.valor)
  })()

  // ── Transportadora agregada ──
  const transpAgg = (() => {
    const m: Record<string,any> = {}
    fTransp.forEach(x => {
      const k = x.unidade
      if (!m[k]) m[k] = {unidade:k, litros:0, diesel:0, outras:0, total:0, km:0}
      m[k].litros += +x.litros||0
      m[k].diesel += +x.custo_diesel||0
      m[k].outras += +x.outras_despesas||0
      m[k].total  += +x.custo_total||0
      m[k].km     += +x.km_rodados||0
    })
    return Object.values(m).map((x:any) => ({
      ...x,
      kmL:     x.km>0 && x.litros>0 ? x.km/x.litros : 0,
      custoKm: x.km>0 ? x.total/x.km : 0,
    })).sort((a:any,b:any)=>b.total-a.total)
  })()
  const transpTot = transpAgg.reduce((s:any,x:any)=>({
    litros:s.litros+x.litros, diesel:s.diesel+x.diesel, outras:s.outras+x.outras, total:s.total+x.total,
  }), {litros:0,diesel:0,outras:0,total:0})

  // ── Conta corrente agregada no período ──
  const contaAgg = (() => {
    const m: Record<string,any> = {}
    fConta.forEach(x => {
      const k = x.parceiro
      if (!m[k]) m[k] = {parceiro:k, compras:0, vendas:0, tonC:0, tonV:0, credito:0, debito:0, recebido:0, pago:0}
      m[k].compras  += +x.compras_madeira||0
      m[k].vendas   += +x.vendas||0
      m[k].tonC     += +x.ton_compradas||0
      m[k].tonV     += +x.ton_vendidas||0
      m[k].credito  += +x.ajuste_credito||0
      m[k].debito   += +x.ajuste_debito||0
      m[k].recebido += +x.recebido||0
      m[k].pago     += +x.pago||0
    })
    return Object.values(m).map((x:any)=>{
      // saldo REAL acumulado (nao do periodo) vindo da view v_saldo_parceiro
      const sr = saldos.find((sf:any)=> (sf.parceiro||'').toUpperCase().trim() === (x.parceiro||'').toUpperCase().trim())
      const saldoReal = sr ? (+sr.saldo_final||0) : ((x.vendas + x.credito - x.recebido) - (x.compras + x.debito - x.pago))
      return {...x, saldo: saldoReal}
    }).sort((a:any,b:any)=>Math.abs(b.saldo)-Math.abs(a.saldo))
  })()

  // ── Vendas por produto ──
  const vendasProd = (() => {
    const m: Record<string,any> = {}
    fVendas.forEach(x => {
      const k = x.produto || '—'
      if (!m[k]) m[k] = {produto:k, qtd:0, tons:0, m3:0, val:0}
      m[k].qtd  += +x.vendas||0
      m[k].tons += +x.toneladas||0
      m[k].m3   += +x.m3||0
      m[k].val  += +x.faturado||0
    })
    return Object.values(m).sort((a:any,b:any)=>b.val-a.val)
  })()

  const TABS: [Tab,string][] = [
    ['custo','💰 Custo/m³'], ['centros','📊 Centros'], ['transporte','🚛 Transporte'],
    ['conta','🤝 Conta Corrente'], ['vendas','🛒 Vendas'],
  ]

  function imprimirGerencial() {
    const w = window.open('', '_blank')
    const esc = (s:any) => String(s==null?'':s).replace(/[&<>"']/g, (c:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
    if (!w) { toast.error('Permita pop-ups para imprimir'); return }
    const periodoTxt = meses.length === 1 ? `Mês: ${meses[0]}`
      : meses.length > 1 ? `${meses[0]} a ${meses[meses.length-1]}` : 'Todos os períodos'

    const secCusto = `
      <h2>COMPOSIÇÃO DO CUSTO POR m³</h2>
      <table>
        <tr><td>Matéria-Prima</td><td class="r">R$ ${(T.m3>0?T.materiaPrima/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Mão de Obra</td><td class="r">R$ ${(T.m3>0?T.maoObra/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Manutenção</td><td class="r">R$ ${(T.m3>0?T.manutencao/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Energia</td><td class="r">R$ ${(T.m3>0?T.energia/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Caldeira</td><td class="r">R$ ${(T.m3>0?T.caldeira/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Combustível</td><td class="r">R$ ${(T.m3>0?T.combustivel/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Administrativo</td><td class="r">R$ ${(T.m3>0?T.administrativo/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Máquinas</td><td class="r">R$ ${(T.m3>0?T.maquinas/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Despesas Diversas</td><td class="r">R$ ${(T.m3>0?T.diversas/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Custos Fixos e Adm</td><td class="r">R$ ${(T.m3>0?T.fixosAdm/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr><td>Melhorias</td><td class="r">R$ ${(T.m3>0?T.melhorias/T.m3:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/m³</td></tr>
        <tr class="tot"><td><b>CUSTO TOTAL / m³</b></td><td class="r"><b>${money(custoM3)}</b></td></tr>
      </table>
      <p class="obs">Base: ${T.m3.toFixed(2)} m³ produzidos no período</p>`

    const secConta = `
      <h2>CONTA CORRENTE</h2>
      <table>
        <thead><tr><th>Parceiro</th><th class="r">Compras</th><th class="r">Ton Comp.</th><th class="r">R$/t Médio</th><th class="r">Vendas</th><th class="r">Ton Vend.</th><th class="r">Recebido</th><th class="r">Pago</th><th class="r">Saldo</th></tr></thead>
        <tbody>${contaAgg.map((c:any)=>`
          <tr><td>${esc(c.parceiro)}</td>
            <td class="r">${c.compras.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${(c.tonC||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${(c.tonC>0?c.compras/c.tonC:0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${c.vendas.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${(c.tonV||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${c.recebido.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${c.pago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r"><b>${c.saldo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</b></td></tr>`).join('')}</tbody>
      </table>`

    const secVendas = `
      <h2>VENDAS POR PRODUTO</h2>
      <table>
        <thead><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Ton</th><th class="r">m³</th><th class="r">Faturado</th></tr></thead>
        <tbody>${vendasProd.map((p:any)=>`
          <tr><td>${p.produto}</td><td class="r">${p.qtd}</td>
            <td class="r">${p.tons.toFixed(1)}</td><td class="r">${p.m3.toFixed(1)}</td>
            <td class="r">${p.val.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`).join('')}</tbody>
      </table>`

    const secCentros = `
      <h2>CENTROS DE CUSTO</h2>
      <table>
        <thead><tr><th>Centro</th><th class="r">Valor</th><th class="r">Por m³</th></tr></thead>
        <tbody>${centrosAgg.map((c:any)=>`
          <tr><td>${c.centro}</td>
            <td class="r">${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${c.porM3.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`).join('')}</tbody>
      </table>`

    const secTransp = `
      <h2>TRANSPORTE</h2>
      <table>
        <thead><tr><th>Unidade</th><th class="r">Litros</th><th class="r">Diesel</th><th class="r">Outras</th><th class="r">Total</th></tr></thead>
        <tbody>${transpAgg.map((v:any)=>`
          <tr><td>${v.unidade}</td><td class="r">${v.litros.toFixed(1)}</td>
            <td class="r">${v.diesel.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${v.outras.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="r">${v.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`).join('')}</tbody>
      </table>`

    w.document.write(`
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dashboard Gerencial</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, sans-serif; color:#000; font-size:11px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  h1 { font-size:17px; text-align:center; margin-bottom:2px; }
  .sub { text-align:center; font-size:11px; color:#000; margin-bottom:16px; }
  h2 { font-size:12px; background:#d0d0d0; padding:6px 8px; margin:14px 0 6px; border-left:4px solid #f97316; color:#000; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; }
  th, td { border:1px solid #333; padding:4px 6px; font-size:10px; color:#000; }
  th { background:#d0d0d0; }
  .r { text-align:right; }
  .tot { background:#ffd9a8; }
  .kpi { display:flex; gap:12px; margin-bottom:14px; }
  .kpi div { flex:1; border:1px solid #333; padding:8px; text-align:center; }
  .kpi b { display:block; font-size:14px; }
  .obs { font-size:10px; color:#333; }
</style></head><body>
  <h1>DASHBOARD GERENCIAL</h1>
  <div class="sub">${periodoTxt} · Emitido em ${new Date().toLocaleString('pt-BR')}</div>

  <div class="kpi">
    <div><b>${T.m3.toFixed(0)} m³</b>Produzido</div>
    <div><b>${money(custoTotal)}</b>Custo total</div>
    <div><b>${money(custoM3)}</b>Custo/m³</div>
    <div><b>${money(fatTotal)}</b>Faturado</div>
    <div><b>${money(margem)}</b>${margem>=0?'Margem':'Prejuízo'}</div>
  </div>

  ${secCusto}
  ${secCentros}
  ${secTransp}
  ${secConta}
  ${secVendas}
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`)
    w.document.close()
  }

  function Row({label, value, color, bold}: any) {
    return (
      <div className="flex justify-between py-1" style={{fontSize:'12px'}}>
        <span style={{color:'var(--t3)'}}>{label}</span>
        <span style={{fontWeight: bold?800:700, color: color||'var(--t1)'}}>{value}</span>
      </div>
    )
  }

  return (
    <div className="page-enter p-3">
      <SH label="📈 Dashboard Gerencial" action={
        <Btn onClick={imprimirGerencial} variant="secondary" size="sm">🖨️ Imprimir</Btn>
      } />

      {/* Filtro de período */}
      <div className="rounded-xl p-2.5 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {([['mes','📅 Mês atual'],['3m','🕐 3 meses'],['ano','📆 Ano'],['custom','⚙️ Período']] as [typeof period,string][]).map(([k,l])=>(
            <div key={k} onClick={()=>setPeriod(k)}
              style={{flexShrink:0,padding:'5px 11px',borderRadius:'16px',fontSize:'10px',fontWeight:700,cursor:'pointer',
                background:period===k?'rgba(249,115,22,.14)':'var(--s2)',
                border:`1px solid ${period===k?'rgba(249,115,22,.4)':'var(--bd)'}`,
                color:period===k?'#f97316':'var(--t3)',whiteSpace:'nowrap'}}>{l}</div>
          ))}
        </div>
        {period==='custom' && (
          <div className="grid grid-cols-2 gap-x-2 mt-2">
            <Input label="De" value={pFrom} onChange={setPFrom} type="date" />
            <Input label="Até" value={pTo} onChange={setPTo} type="date" />
          </div>
        )}
        {meses.length > 0 && (
          <div style={{fontSize:'9px',color:'var(--t3)',marginTop:'6px'}}>
            {meses.length === 1 ? `Mês: ${meses[0]}` : `${meses.length} meses: ${meses[0]} a ${meses[meses.length-1]}`}
          </div>
        )}
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <KPI num={`${T.m3.toFixed(0)}m³`} label="Produzido" color="green" />
        <KPI num={moneyK(custoTotal)} label="Custo total" color="red" />
        <KPI num={money(custoM3).replace('R$ ','R$')} label="Custo/m³" color="orange" />
        <KPI num={moneyK(fatTotal)} label="Faturado" color="blue" />
      </div>

      {/* Indicadores adicionais */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KPI num={moneyK(T.materiaPrima)} label="Matéria-Prima" color="orange" />
        <KPI num={moneyK(totalCentros)} label="Centros de Custo" color="red" />
        <KPI num={`${mediaProducao.toFixed(0)}m³`} label="Média Produção/mês" color="green" />
      </div>

      {/* Margem */}
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:`1px solid ${margem>=0?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'}`}}>
        <div className="flex justify-between items-center">
          <span style={{fontSize:'11px',color:'var(--t3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px'}}>
            {margem>=0?'📈 Margem do período':'📉 Prejuízo do período'}
          </span>
          <span style={{fontSize:'16px',fontWeight:800,color:margem>=0?'var(--gn)':'var(--rd)'}}>{money(margem)}</span>
        </div>
        <div style={{fontSize:'9px',color:'var(--t3)',marginTop:'2px'}}>
          Faturado {money(fatTotal)} − Custo {money(custoTotal)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {TABS.map(([t,l])=>(
          <div key={t} onClick={()=>setTab(t)}
            style={{flexShrink:0,padding:'7px 12px',borderRadius:'10px',fontSize:'11px',fontWeight:700,cursor:'pointer',
              background:tab===t?'rgba(249,115,22,.12)':'var(--s1)',
              border:`1px solid ${tab===t?'rgba(249,115,22,.4)':'var(--bd)'}`,
              color:tab===t?'#f97316':'var(--t2)',whiteSpace:'nowrap'}}>{l}</div>
        ))}
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> : <>

        {/* ═══ CUSTO/m³ ═══ */}
        {tab==='custo' && (
          <>
            <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid rgba(249,115,22,.25)'}}>
              <div style={{fontSize:'10px',fontWeight:700,color:'#f97316',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>
                💰 COMPOSIÇÃO DO CUSTO POR m³
              </div>
              <Row label="🪵 Matéria-Prima" value={`${money(T.m3>0?T.materiaPrima/T.m3:0)}/m³`} color="var(--gn)" />
              <Row label="👷 Mão de Obra" value={`${money(T.m3>0?T.maoObra/T.m3:0)}/m³`} color="var(--cy)" />
              <Row label="🔧 Manutenção" value={`${money(T.m3>0?T.manutencao/T.m3:0)}/m³`} color="var(--am)" />
              <Row label="⚡ Energia" value={`${money(T.m3>0?T.energia/T.m3:0)}/m³`} color="var(--am)" />
              <Row label="🔥 Caldeira" value={`${money(T.m3>0?T.caldeira/T.m3:0)}/m³`} color="var(--am)" />
              <Row label="⛽ Combustível" value={`${money(T.m3>0?T.combustivel/T.m3:0)}/m³`} color="var(--am)" />
              <Row label="📋 Administrativo" value={`${money(T.m3>0?T.administrativo/T.m3:0)}/m³`} color="var(--pp)" />
              <Row label="⚙️ Máquinas" value={`${money(T.m3>0?T.maquinas/T.m3:0)}/m³`} color="var(--cy)" />
              <Row label="📦 Despesas Diversas" value={`${money(T.m3>0?T.diversas/T.m3:0)}/m³`} color="var(--pp)" />
              <Row label="🏢 Custos Fixos e Adm" value={`${money(T.m3>0?T.fixosAdm/T.m3:0)}/m³`} color="var(--rd)" />
              <Row label="🔨 Melhorias" value={`${money(T.m3>0?T.melhorias/T.m3:0)}/m³`} color="var(--gn)" />
              <div style={{height:'1px',background:'var(--bd)',margin:'6px 0'}} />
              <Row label="CUSTO TOTAL / m³" value={money(custoM3)} color="#f97316" bold />
              <div style={{fontSize:'9px',color:'var(--t3)',marginTop:'6px'}}>
                Base: {T.m3.toFixed(2)} m³ produzidos no período
              </div>
            </div>

            {fCustos.length===0 ? <Empty icon="📊" text="Sem dados no período." /> : (
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-2 py-2" style={{gridTemplateColumns:'54px 1fr 60px 60px 62px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Mês</span><span style={{textAlign:'right'}}>m³</span><span style={{textAlign:'right'}}>M.Prima</span><span style={{textAlign:'right'}}>M.Obra</span><span style={{textAlign:'right'}}>Total/m³</span>
                </div>
                {fCustos.map((x,i)=>(
                  <div key={i} className="grid px-2 py-2" style={{gridTemplateColumns:'54px 1fr 60px 60px 62px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'10px'}}>
                    <span style={{color:'var(--t2)',fontWeight:700}}>{x.mes.slice(5)}/{x.mes.slice(2,4)}</span>
                    <span style={{textAlign:'right',color:'var(--gn)'}}>{(+x.m3_produzido).toFixed(0)}</span>
                    <span style={{textAlign:'right'}}>{n2(+x.materia_prima_por_m3)}</span>
                    <span style={{textAlign:'right',color:'var(--am)'}}>{n2(+x.mao_obra_por_m3)}</span>
                    <span style={{textAlign:'right',color:'#f97316',fontWeight:700}}>{n2(+x.custo_total_por_m3)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ CENTROS DE CUSTO ═══ */}
        {tab==='centros' && (
          centrosAgg.length===0 ? <Empty icon="📊" text="Sem despesas no período." /> : (
            <>
              <div style={{fontSize:'9px',color:'var(--t3)',marginBottom:'8px'}}>
                Custo por m³ de cada centro · base {T.m3.toFixed(0)} m³ produzidos
              </div>
              <div className="flex flex-col gap-2">
                {centrosAgg.map((c,i)=>{
                  const totalCC = centrosAgg.reduce((s,x)=>s+x.valor,0)
                  const pct = totalCC>0 ? c.valor/totalCC*100 : 0
                  return (
                    <div key={i} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                      <div className="flex justify-between items-start mb-1.5">
                        <span style={{fontSize:'12px',fontWeight:700}}>{c.centro}</span>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:'13px',fontWeight:800,color:'#f97316'}}>{money(c.porM3)}<span style={{fontSize:'9px',color:'var(--t3)'}}>/m³</span></div>
                          <div style={{fontSize:'9px',color:'var(--t3)'}}>{money(c.valor)} · {pct.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div style={{height:'5px',background:'rgba(255,255,255,.05)',borderRadius:'3px',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:'linear-gradient(90deg,#f97316,#fb923c)',borderRadius:'3px'}} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        )}

        {/* ═══ TRANSPORTADORA ═══ */}
        {tab==='transporte' && (
          <>
            <div style={{fontSize:'9px',color:'var(--t3)',marginBottom:'8px'}}>
              🚛 Diesel dos caminhões — <b style={{color:'var(--t2)'}}>não entra no custo/m³</b>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <KPI num={`${transpTot.litros.toFixed(0)}L`} label="Litros" color="blue" />
              <KPI num={moneyK(transpTot.diesel)} label="Diesel" color="orange" />
              <KPI num={moneyK(transpTot.total)} label="Custo total" color="purple" />
            </div>
            {transpAgg.length===0 ? <Empty icon="🚛" text="Sem abastecimentos no período." /> : (
              <div className="flex flex-col gap-2">
                {transpAgg.map((v:any,i:number)=>(
                  <div key={i} className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                    <div className="flex justify-between items-start mb-1">
                      <span style={{fontSize:'13px',fontWeight:800,color:'var(--cy)',letterSpacing:'.5px'}}>{v.unidade}</span>
                      <span style={{fontSize:'13px',fontWeight:800,color:'#f97316'}}>{money(v.total)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3">
                      <Row label="⛽ Diesel" value={money(v.diesel)} color="var(--cy)" />
                      <Row label="🔧 Outras" value={money(v.outras)} color={v.outras>0?'var(--pp)':'var(--t3)'} />
                      <Row label="💧 Litros" value={v.litros.toFixed(1)} />
                      {v.km>0 && <Row label="🛣 Km" value={v.km.toLocaleString('pt-BR',{maximumFractionDigits:0})} />}
                      {v.kmL>0 && <Row label="📊 Km/L" value={v.kmL.toFixed(2)} color="var(--gn)" />}
                      {v.custoKm>0 && <Row label="💰 R$/km" value={money(v.custoKm)} color="var(--am)" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ CONTA CORRENTE ═══ */}
        {tab==='conta' && (
          contaAgg.length===0 ? <Empty icon="🤝" text="Sem movimentação no período." /> : (
            <>
              <div style={{fontSize:'9px',color:'var(--t3)',marginBottom:'8px'}}>
                Compra de madeira × venda de produtos · saldo positivo = a receber
              </div>
              <div className="flex flex-col gap-2">
                {contaAgg.map((c:any,i:number)=>(
                  <div key={i} className="rounded-xl p-3"
                    style={{background:'var(--s1)',border:`1px solid ${c.saldo>=0?'rgba(34,197,94,.25)':'rgba(239,68,68,.25)'}`}}>
                    <div className="flex justify-between items-start mb-2">
                      <span style={{fontSize:'13px',fontWeight:800}}>{c.parceiro}</span>
                      <Badge color={c.saldo>0?'green':c.saldo<0?'red':'gray'}>
                        {c.saldo>0?'A RECEBER':c.saldo<0?'A PAGAR':'QUITADO'}
                      </Badge>
                    </div>
                    <Row label="🪵 Compras de madeira" value={money(c.compras)} color="var(--rd)" />
                    {c.tonC>0 && <Row label="⚖️ Ton compradas" value={`${c.tonC.toLocaleString('pt-BR',{minimumFractionDigits:2})} t`} color="var(--t3)" />}
                    {c.tonC>0 && <Row label="📊 Custo médio" value={`${money(c.compras/c.tonC)}/t`} color="var(--am)" />}
                    <Row label="🛒 Vendas" value={money(c.vendas)} color="var(--gn)" />
                    {c.tonV>0 && <Row label="⚖️ Ton vendidas" value={`${c.tonV.toLocaleString('pt-BR',{minimumFractionDigits:2})} t`} color="var(--t3)" />}
                    {c.credito>0 && <Row label="➕ Créditos (fretes/saldo ant.)" value={money(c.credito)} color="var(--gn)" />}
                    {c.debito>0 && <Row label="➖ Débitos (pesagens/outros)" value={money(c.debito)} color="var(--rd)" />}
                    {c.recebido>0 && <Row label="💵 Recebido" value={`− ${money(c.recebido)}`} color="var(--t3)" />}
                    {c.pago>0 && <Row label="💸 Pago" value={`− ${money(c.pago)}`} color="var(--t3)" />}
                    <div style={{height:'1px',background:'var(--bd)',margin:'5px 0'}} />
                    <div className="flex justify-between" style={{fontSize:'13px'}}>
                      <span style={{fontWeight:700}}>SALDO</span>
                      <span style={{fontWeight:800,color:c.saldo>=0?'var(--gn)':'var(--rd)'}}>{money(c.saldo)}</span>
                    </div>
                    <div style={{fontSize:'9px',color:'var(--t3)',marginTop:'3px'}}>
                      {c.tonC>0 && `${c.tonC.toFixed(1)}t compradas`}{c.tonC>0&&c.tonV>0?' · ':''}{c.tonV>0 && `${c.tonV.toFixed(1)}t vendidas`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}

        {/* ═══ VENDAS ═══ */}
        {tab==='vendas' && (
          vendasProd.length===0 ? <Empty icon="🛒" text="Sem vendas no período." /> : (
            <>
              <div className="rounded-xl overflow-hidden mb-3" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 34px 56px 48px 76px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Produto</span><span style={{textAlign:'right'}}>Qtd</span><span style={{textAlign:'right'}}>Ton</span><span style={{textAlign:'right'}}>m³</span><span style={{textAlign:'right'}}>Faturado</span>
                </div>
                {vendasProd.map((p:any,i:number)=>(
                  <div key={i} className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 34px 56px 48px 76px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'11px'}}>
                    <span style={{fontWeight:700}}>{p.produto}</span>
                    <span style={{textAlign:'right',color:'var(--t2)'}}>{p.qtd}</span>
                    <span style={{textAlign:'right',color:'var(--cy)'}}>{p.tons.toFixed(1)}</span>
                    <span style={{textAlign:'right',color:'var(--gn)'}}>{p.m3.toFixed(1)}</span>
                    <span style={{textAlign:'right',color:'#f97316',fontWeight:700}}>{p.val>0?p.val.toLocaleString('pt-BR',{maximumFractionDigits:0}):'—'}</span>
                  </div>
                ))}
                <div className="grid px-3 py-2" style={{gridTemplateColumns:'1fr 34px 56px 48px 76px',background:'rgba(249,115,22,.1)',borderTop:'2px solid rgba(249,115,22,.3)',fontSize:'11px',fontWeight:800}}>
                  <span>TOTAL</span>
                  <span style={{textAlign:'right'}}>{vendasProd.reduce((s:any,p:any)=>s+p.qtd,0)}</span>
                  <span style={{textAlign:'right',color:'var(--cy)'}}>{vendasProd.reduce((s:any,p:any)=>s+p.tons,0).toFixed(1)}</span>
                  <span style={{textAlign:'right',color:'var(--gn)'}}>{vendasProd.reduce((s:any,p:any)=>s+p.m3,0).toFixed(1)}</span>
                  <span style={{textAlign:'right',color:'#f97316'}}>{fatTotal.toLocaleString('pt-BR',{maximumFractionDigits:0})}</span>
                </div>
              </div>

              <div style={{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'6px'}}>Detalhe por cliente</div>
              <div className="flex flex-col gap-2">
                {fVendas.map((v:any,i:number)=>(
                  <div key={i} className="rounded-xl p-2.5" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                    <div className="flex justify-between">
                      <div>
                        <span style={{fontSize:'12px',fontWeight:700}}>{v.produto}</span>
                        <span style={{fontSize:'10px',color:'var(--t3)'}}> · {v.cliente}</span>
                      </div>
                      <span style={{fontSize:'12px',fontWeight:700,color:'#f97316'}}>{v.faturado>0?money(+v.faturado):'—'}</span>
                    </div>
                    <div style={{fontSize:'9px',color:'var(--t3)',marginTop:'2px'}}>
                      {v.mes} · {v.vendas} venda(s){+v.toneladas>0?` · ${(+v.toneladas).toFixed(1)}t`:''}{+v.m3>0?` · ${(+v.m3).toFixed(1)}m³`:''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </>}
    </div>
  )
}
