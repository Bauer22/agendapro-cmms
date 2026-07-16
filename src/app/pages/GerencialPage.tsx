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
    const [c, cc, t, k, s, v] = await Promise.all([
      supabase.from('v_custo_m3_mensal').select('*'),
      supabase.from('v_custo_m3_centro').select('*'),
      supabase.from('v_transportadora').select('*'),
      supabase.from('v_conta_corrente').select('*'),
      supabase.from('v_saldo_parceiro').select('*'),
      supabase.from('v_vendas_produto_mes').select('*'),
    ])
    if (c.error) toast.error('Erro: '+c.error.message+' — execute o SQL das views')
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

  // ── Consolidado do período ──
  const T = {
    m3:       fCustos.reduce((s,x)=>s+(+x.m3_produzido||0),0),
    madeira:  fCustos.reduce((s,x)=>s+(+x.custo_madeira||0),0),
    diesel:   fCustos.reduce((s,x)=>s+(+x.custo_diesel_producao||0),0),
    despesas: fCustos.reduce((s,x)=>s+(+x.despesas_gerais||0),0),
  }
  const custoTotal = T.madeira + T.diesel + T.despesas
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
      if (!m[k]) m[k] = {parceiro:k, compras:0, vendas:0, tonC:0, tonV:0}
      m[k].compras += +x.compras_madeira||0
      m[k].vendas  += +x.vendas||0
      m[k].tonC    += +x.ton_compradas||0
      m[k].tonV    += +x.ton_vendidas||0
    })
    return Object.values(m).map((x:any)=>({...x, saldo: x.vendas - x.compras}))
      .sort((a:any,b:any)=>Math.abs(b.saldo)-Math.abs(a.saldo))
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
      <SH label="📈 Dashboard Gerencial" />

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
              <Row label="🪵 Madeira" value={`${money(T.m3>0?T.madeira/T.m3:0)}/m³`} color="var(--gn)" />
              <Row label="⛽ Diesel produção" value={`${money(T.m3>0?T.diesel/T.m3:0)}/m³`} color="var(--am)" />
              <Row label="📊 Despesas gerais" value={`${money(T.m3>0?T.despesas/T.m3:0)}/m³`} color="var(--pp)" />
              <div style={{height:'1px',background:'var(--bd)',margin:'6px 0'}} />
              <Row label="CUSTO TOTAL / m³" value={money(custoM3)} color="#f97316" bold />
              <div style={{fontSize:'9px',color:'var(--t3)',marginTop:'6px'}}>
                Base: {T.m3.toFixed(2)} m³ produzidos no período
              </div>
            </div>

            {fCustos.length===0 ? <Empty icon="📊" text="Sem dados no período." /> : (
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--bd)'}}>
                <div className="grid px-2 py-2" style={{gridTemplateColumns:'54px 1fr 60px 60px 62px',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
                  <span>Mês</span><span style={{textAlign:'right'}}>m³</span><span style={{textAlign:'right'}}>Madeira</span><span style={{textAlign:'right'}}>Diesel</span><span style={{textAlign:'right'}}>Total/m³</span>
                </div>
                {fCustos.map((x,i)=>(
                  <div key={i} className="grid px-2 py-2" style={{gridTemplateColumns:'54px 1fr 60px 60px 62px',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'10px'}}>
                    <span style={{color:'var(--t2)',fontWeight:700}}>{x.mes.slice(5)}/{x.mes.slice(2,4)}</span>
                    <span style={{textAlign:'right',color:'var(--gn)'}}>{(+x.m3_produzido).toFixed(0)}</span>
                    <span style={{textAlign:'right'}}>{n2(+x.madeira_por_m3)}</span>
                    <span style={{textAlign:'right',color:'var(--am)'}}>{n2(+x.diesel_por_m3)}</span>
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
                    <Row label="🛒 Vendas" value={money(c.vendas)} color="var(--gn)" />
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
