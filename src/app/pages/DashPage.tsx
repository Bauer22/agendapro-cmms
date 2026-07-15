'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { KPI, SH, Empty, Input } from '@/components/ui'
import { fmtD, STATUS_INFO, PRIO_COLOR, oilStatus, DPT, MPT, MFULL } from '@/lib/utils'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean; onNavigate:(p:any)=>void }

const money = (v:number) => `R$ ${(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`

export default function DashPage({ profile, can, onNavigate }: Props) {
  const [data, setData]     = useState<any>({})
  const [period, setPeriod] = useState<'mes'|'30d'|'ano'|'custom'>('mes')
  const [pFrom, setPFrom]   = useState('')
  const [pTo, setPTo]       = useState('')
  const [loading, setLoad]  = useState(true)
  const [calMonth, setCalMonth] = useState(new Date())

  useEffect(() => { load() }, [period, pFrom, pTo])

  async function load() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const now2 = new Date()
      let monthStart: string, rangeEnd: string = today
      if (period === 'mes')      monthStart = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split('T')[0]
      else if (period === '30d') monthStart = new Date(Date.now()-30*86400000).toISOString().split('T')[0]
      else if (period === 'ano') monthStart = new Date(now2.getFullYear(), 0, 1).toISOString().split('T')[0]
      else { monthStart = pFrom || new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split('T')[0]; rangeEnd = pTo || today }
      const [os, mach, maint, tasks, parts, downtime, oeeRecs, woodRecs, salesRecs, audits, trainings, epis, bills, ccs, fuelRecs, vehExps, prodRecs] = await Promise.all([
        supabase.from('work_orders').select('*'),
        supabase.from('machines').select('*'),
        supabase.from('maintenance').select('*').order('date',{ascending:false}).limit(5),
        supabase.from('tasks').select('*').eq('date', today),
        supabase.from('parts').select('stock,min_stock,name,unit,code'),
        supabase.from('downtime_records').select('*').eq('status','open'),
        supabase.from('oee_records').select('planned_time,operating_time,total_pieces,defect_pieces,ideal_cycle_time').gte('record_date', monthStart).lte('record_date', rangeEnd),
        supabase.from('wood_entries').select('volume_m3,total_value,data_entrada').gte('data_entrada', monthStart).lte('data_entrada', rangeEnd),
        supabase.from('sales_orders').select('status,total_value,sale_date').in('status',['quote','confirmed','production','delivered','active']).gte('sale_date', monthStart).lte('sale_date', rangeEnd),
        supabase.from('audits').select('score,status,created_at').gte('created_at', new Date(Date.now()-30*86400000).toISOString()),
        supabase.from('trainings').select('status,expiry_date').lte('expiry_date', today),
        supabase.from('epi_items').select('stock,min_stock'),
        supabase.from('accounts_payable').select('valor,status,due_date,centro_custo_id').gte('due_date', monthStart).lte('due_date', rangeEnd),
        supabase.from('cost_centers').select('id,codigo,descricao'),
        supabase.from('fuel_records').select('liters,total_value,record_date').gte('record_date', monthStart).lte('record_date', rangeEnd),
        supabase.from('vehicle_expenses').select('value,expense_date').gte('expense_date', monthStart).lte('expense_date', rangeEnd),
        supabase.from('production_records').select('tank_m3,produced_m3,prod_date').gte('prod_date', monthStart).lte('prod_date', rangeEnd),
      ])

      const osList   = os.data||[]
      const machList = mach.data||[]
      const alerts: any[] = []

      // Machine alerts
      machList.forEach((m:any) => {
        if (m.category==='transport'&&m.oil_interval) {
          const st = oilStatus(m.current_hours||0, m.last_oil_hours||0, m.oil_interval)
          if (st.color!=='gn') alerts.push({level:st.color,icon:m.icon||'⚙️',title:`${m.name} — Troca de Óleo`,sub:st.label})
        }
      })

      // Overdue OS
      osList.filter((o:any)=>o.due_date&&o.due_date<today&&o.status!=='done'&&o.status!=='cancelled')
        .forEach((o:any)=>alerts.push({level:'rd',icon:'📋',title:`OS ${o.number} — ${o.title}`,sub:`Atrasada desde ${fmtD(o.due_date)}`}))

      // Low stock
      ;(parts.data||[]).filter((p:any)=>p.stock<=p.min_stock)
        .forEach((p:any)=>alerts.push({level:'am',icon:'📦',title:`${p.name} — Estoque baixo`,sub:`${p.stock} ${p.unit}`}))

      // Open downtimes
      ;(downtime.data||[]).forEach((d:any) => {
        const mach2 = machList.find((m:any)=>m.id===d.machine_id)
        alerts.push({level:'rd',icon:'⏱️',title:`${mach2?.name||'Máquina'} — Parada em aberto`,sub:d.cause})
      })

      // MTBF/MTTR from downtime (simple calculation)
      const { data: dtAll } = await supabase.from('downtime_records').select('*').gte('created_at', new Date(Date.now()-30*86400000).toISOString())
      const closedDt = (dtAll||[]).filter((r:any)=>r.duration_min)
      const avgMTTR = closedDt.length > 0 ? (closedDt.reduce((s:number,r:any)=>s+(r.duration_min||0),0)/closedDt.length/60).toFixed(1) : '—'
      const totalDownH = closedDt.reduce((s:number,r:any)=>s+(r.duration_min||0),0)/60
      const availPct = totalDownH > 0 ? (100-totalDownH/(30*24)*100).toFixed(1) : '99.9'

      // Pareto: failures by machine
      const failureMap: Record<string,number> = {}
      ;(dtAll||[]).forEach((r:any)=>{
        if (!r.machine_id) return
        const m2 = machList.find((m:any)=>m.id===r.machine_id)
        const name = m2?.name||'Desconhecida'
        failureMap[name] = (failureMap[name]||0)+1
      })
      const pareto = Object.entries(failureMap).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)

      // OEE calculation
      const oeeList = oeeRecs.data||[]
      const avgOEE = oeeList.length > 0 ? (() => {
        const total = oeeList.reduce((s:any,r:any)=>{
          const av = r.planned_time>0?r.operating_time/r.planned_time:0
          const pf = r.operating_time>0?(r.ideal_cycle_time*r.total_pieces/r.operating_time):0
          const ql = r.total_pieces>0?(r.total_pieces-r.defect_pieces)/r.total_pieces:0
          return s + av*pf*ql*100
        }, 0)
        return (total/oeeList.length).toFixed(1)
      })() : '—'

      // Wood and sales totals this month
      const woodM3 = (woodRecs.data||[]).reduce((s:any,r:any)=>s+(r.volume_m3||0),0).toFixed(1)
      const salesTotal = (salesRecs.data||[]).reduce((s:any,r:any)=>s+(r.total_value||0),0)
      const salesOpen = (salesRecs.data||[]).filter((r:any)=>['confirmed','production'].includes(r.status)).length

      // Audit score
      const auditList = audits.data||[]
      const avgAudit = auditList.length > 0 ? Math.round(auditList.reduce((s:any,r:any)=>s+(r.score||0),0)/auditList.length) : null

      // Trainings expiring
      const trainExp = (trainings.data||[]).filter((t:any)=>t.status!=='cancelled').length

      // EPI alerts
      const epiLow = (epis.data||[]).filter((e:any)=>e.stock<=e.min_stock).length
      if (epiLow > 0) alerts.push({level:'am',icon:'🦺',title:`${epiLow} EPI(s) com estoque baixo`,sub:'Verifique o módulo EPI'})
      if (trainExp > 0) alerts.push({level:'am',icon:'🎓',title:`${trainExp} treinamento(s) vencido(s)`,sub:'Renovar certificações'})

      // Financeiro
      const billList = bills.data||[]
      const ccList = ccs.data||[]
      const totalDesp = billList.reduce((s:any,b:any)=>s+(parseFloat(b.valor)||0),0)
      const paidDesp  = billList.filter((b:any)=>b.status==='paid').reduce((s:any,b:any)=>s+(parseFloat(b.valor)||0),0)
      const pendDesp  = totalDesp - paidDesp
      // por centro de custo
      const ccMap: Record<string,{nome:string;valor:number}> = {}
      billList.forEach((b:any) => {
        const cc = ccList.find((x:any)=>x.id===b.centro_custo_id)
        const k = cc ? `${cc.codigo} - ${cc.descricao}` : 'Sem centro'
        if (!ccMap[k]) ccMap[k] = {nome:k, valor:0}
        ccMap[k].valor += parseFloat(b.valor)||0
      })
      const ccRows = Object.values(ccMap).sort((a,b)=>b.valor-a.valor).slice(0,8)

      // Combustível
      const fuelList = fuelRecs.data||[]
      const fuelLiters = fuelList.reduce((s:any,f:any)=>s+(parseFloat(f.liters)||0),0)
      const fuelCost   = fuelList.reduce((s:any,f:any)=>s+(parseFloat(f.total_value)||0),0)
      const vehCost    = (vehExps.data||[]).reduce((s:any,v:any)=>s+(parseFloat(v.value)||0),0)

      // Produção
      const prodList = prodRecs.data||[]
      const prodTank = prodList.reduce((s:any,r:any)=>s+(parseFloat(r.tank_m3)||0),0)
      const prodM3   = prodList.reduce((s:any,r:any)=>s+(parseFloat(r.produced_m3)||0),0)
      const prodYield = prodM3 > 0 ? prodTank/prodM3 : 0

      // Madeira e vendas do período
      const woodTonsTotal = (woodRecs.data||[]).reduce((s:any,w:any)=>s+(parseFloat(w.weight_tons)||parseFloat(w.peso_liquido)||0),0)
      const woodValTotal  = (woodRecs.data||[]).reduce((s:any,w:any)=>s+(parseFloat(w.total_value)||0),0)
      const salesTons     = (salesRecs.data||[]).reduce((s:any,o:any)=>s+(parseFloat(o.weight_tons)||0),0)

      setData({
        osOpen:     osList.filter((o:any)=>o.status==='open').length,
        osProgress: osList.filter((o:any)=>o.status==='progress').length,
        osDone:     osList.filter((o:any)=>o.status==='done').length,
        osOverdue:  osList.filter((o:any)=>o.due_date&&o.due_date<today&&o.status!=='done'&&o.status!=='cancelled').length,
        machines:   machList.length,
        openDowntime:(downtime.data||[]).length,
        avgMTTR, availPct,
        alerts: alerts.sort((a:any,b:any)=>a.level==='rd'?-1:1).slice(0,8),
        recentOS: osList.filter((o:any)=>o.open_date===today||o.status==='progress').slice(0,5),
        todayTasks:(tasks.data||[]),
        recentMaint:(maint.data||[]),
        pareto,
        pendingBills: 0,
        osAll: osList,
        avgOEE, woodM3, salesTotal, salesOpen, avgAudit, trainExp, epiLow,
        totalDesp, paidDesp, pendDesp, ccRows,
        fuelLiters, fuelCost, vehCost,
        prodTank, prodM3, prodYield,
        woodTonsTotal, woodValTotal, salesTons,
      })
    } catch(e) { console.error(e) }
    finally { setLoad(false) }
  }

  // Calendar helpers
  function getOSForDate(dateStr: string) {
    return (data.osAll||[]).filter((o:any) => o.open_date===dateStr||o.due_date===dateStr)
  }
  function calDays() {
    const y = calMonth.getFullYear(), m = calMonth.getMonth()
    const first = new Date(y,m,1).getDay()
    const days = new Date(y,m+1,0).getDate()
    const cells = []
    for (let i=0;i<first;i++) cells.push(null)
    for (let d=1;d<=days;d++) cells.push(d)
    return cells
  }

  if (loading) return <div className="text-center py-10 text-3xl animate-spin">⚙️</div>

  const today = new Date().toISOString().split('T')[0]
  const todayIsWeekend = [0,6].includes(new Date().getDay())

  return (
    <div>
      {/* KPIs */}
      <div className="rounded-xl p-2.5 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        <div className="flex gap-1.5 mb-1 overflow-x-auto pb-0.5">
          {([['mes','📅 Mês'],['30d','🕐 30 dias'],['ano','📆 Ano'],['custom','⚙️ Período']] as ['mes'|'30d'|'ano'|'custom',string][]).map(([k,l])=>(
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
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <KPI num={data.osOpen||0}    label="OS Abertas"   color="blue"  />
        <KPI num={data.osProgress||0} label="Andamento"   color="amber" />
        <KPI num={data.osDone||0}    label="Concluídas"   color="green" />
        <KPI num={data.osOverdue||0} label="Atrasadas"    color={data.osOverdue>0?'red':'green'} />
      </div>

      {/* New Modules KPIs */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {data.avgOEE&&data.avgOEE!=='—'&&<KPI num={`${data.avgOEE}%`} label="OEE Médio" color="purple" />}
        {data.woodM3&&parseFloat(data.woodM3)>0&&<KPI num={`${data.woodM3}m³`} label="Madeira/mês" color="green" />}
        {data.salesOpen>0&&<KPI num={data.salesOpen} label="Pedidos abertos" color="amber" />}
        {data.avgAudit&&<KPI num={`${data.avgAudit}%`} label="Score Auditoria" color={data.avgAudit>=80?'green':data.avgAudit>=60?'amber':'red'} />}
      </div>

      {/* ═══ FINANCEIRO DO PERÍODO ═══ */}
      {(data.totalDesp > 0 || data.woodValTotal > 0) && (
        <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid rgba(249,115,22,.2)'}}>
          <div style={{fontSize:'10px',fontWeight:700,color:'#f97316',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>
            💰 FINANCEIRO DO PERÍODO
          </div>
          {[
            ['Despesas totais', money(data.totalDesp), 'var(--t1)'],
            ['Pagas', money(data.paidDesp), 'var(--gn)'],
            ['Pendentes', money(data.pendDesp), data.pendDesp>0?'var(--rd)':'var(--t3)'],
            ['—','',''],
            ['Compra de madeira', money(data.woodValTotal), 'var(--t1)'],
            ['Combustível', money(data.fuelCost), 'var(--am)'],
            ['Despesas de veículos', money(data.vehCost), 'var(--pp)'],
          ].map(([l,v,col],i) =>
            l==='—' ? <div key={i} style={{height:'1px',background:'var(--bd)',margin:'6px 0'}} />
            : (
              <div key={i} className="flex justify-between py-1" style={{fontSize:'12px'}}>
                <span style={{color:'var(--t3)'}}>{l}</span>
                <span style={{fontWeight:700,color:col}}>{v}</span>
              </div>
            )
          )}
        </div>
      )}

      {/* ═══ DESPESAS POR CENTRO DE CUSTO ═══ */}
      {data.ccRows?.length > 0 && (
        <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div style={{fontSize:'10px',fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>
            📊 DESPESAS POR CENTRO DE CUSTO
          </div>
          {data.ccRows.map((cc:any,i:number) => {
            const pct = data.totalDesp > 0 ? (cc.valor/data.totalDesp*100) : 0
            return (
              <div key={i} style={{marginBottom:'7px'}}>
                <div className="flex justify-between" style={{fontSize:'11px',marginBottom:'3px'}}>
                  <span style={{color:'var(--t2)'}}>{cc.nome}</span>
                  <span style={{fontWeight:700,color:'var(--cy)'}}>{money(cc.valor)}</span>
                </div>
                <div style={{height:'5px',background:'rgba(255,255,255,.05)',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:'linear-gradient(90deg,#f97316,#fb923c)',borderRadius:'3px'}} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ OPERAÇÃO: MADEIRA / PRODUÇÃO / VENDAS ═══ */}
      {(data.woodTonsTotal > 0 || data.prodM3 > 0 || data.salesTons > 0) && (
        <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid rgba(34,197,94,.2)'}}>
          <div style={{fontSize:'10px',fontWeight:700,color:'var(--gn)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>
            🏭 OPERAÇÃO DO PERÍODO
          </div>
          {[
            ['🪵 Entrada de madeira', `${(data.woodTonsTotal||0).toFixed(2)} t`],
            ['🛢 Tanque processado', `${(data.prodTank||0).toFixed(2)} m³`],
            ['🏭 Produzido', `${(data.prodM3||0).toFixed(2)} m³`],
            ['📊 Renda média', (data.prodYield||0).toFixed(4)],
            ['🛒 Vendas (saída)', `${(data.salesTons||0).toFixed(2)} t`],
            ['⛽ Combustível', `${(data.fuelLiters||0).toFixed(0)} L`],
          ].map(([l,v],i) => (
            <div key={i} className="flex justify-between py-1" style={{fontSize:'12px'}}>
              <span style={{color:'var(--t3)'}}>{l}</span>
              <span style={{fontWeight:700}}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* MTBF/MTTR/Availability row */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[
          {l:'MTTR Médio', v:data.avgMTTR==='—'?'—':`${data.avgMTTR}h`, c:'var(--am)', tip:'Tempo médio de reparo'},
          {l:'Disponib.', v:`${data.availPct}%`, c:parseFloat(data.availPct||'0')>90?'var(--gn)':'var(--rd)', tip:'Últimos 30 dias'},
          {l:'Paradas Abertas', v:data.openDowntime||0, c:data.openDowntime>0?'var(--rd)':'var(--gn)', tip:'Em andamento agora'},
        ].map(k=>(
          <div key={k.l} onClick={()=>onNavigate('downtime')} className="rounded-xl p-2 text-center relative overflow-hidden cursor-pointer" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div className="absolute top-0 inset-x-0 h-0.5" style={{background:k.c}}/>
            <div className="font-bebas text-2xl" style={{color:k.c}}>{k.v}</div>
            <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Weekend button */}
      {todayIsWeekend && (
        <div onClick={()=>onNavigate('os')} className="flex items-center gap-2 p-2.5 rounded-xl mb-3 cursor-pointer" style={{background:'rgba(167,139,250,.1)',border:'1px solid rgba(167,139,250,.4)'}}>
          <span className="text-base">🗓️</span>
          <div className="flex-1 text-xs font-semibold" style={{color:'#a78bfa'}}>Hoje é fim de semana — clique para criar OS de Fim de Semana</div>
          <span className="text-xs" style={{color:'#a78bfa'}}>→</span>
        </div>
      )}

      {/* Alerts */}
      <SH label="Alertas" action={<button onClick={()=>onNavigate('machines')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--cy)',color:'#000',border:'none',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>Ver Máquinas</button>} />
      {data.alerts?.length ? (
        <div className="flex flex-col gap-1.5 mb-3">
          {data.alerts.map((a:any,i:number)=>(
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer"
              style={{border:`1px solid ${a.level==='rd'?'rgba(239,68,68,.4)':'rgba(245,158,11,.35)'}`,background:a.level==='rd'?'rgba(239,68,68,.06)':'rgba(245,158,11,.06)'}}>
              <span className="text-lg flex-shrink-0">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{a.title}</div>
                <div className="text-xs" style={{color:'var(--t2)'}}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 rounded-xl mb-3" style={{border:'1px solid rgba(16,185,129,.3)',background:'rgba(16,185,129,.06)'}}>
          <span className="text-lg">✅</span>
          <div className="text-xs font-semibold">Tudo em dia!</div>
        </div>
      )}

      {/* Pareto */}
      {data.pareto?.length > 0 && (
        <>
          <SH label="Diagrama de Pareto — Top Falhas" action={<button onClick={()=>onNavigate('downtime')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--s2)',color:'var(--t2)',border:'1px solid var(--bd)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>Ver Paradas</button>} />
          <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            {data.pareto.map(([name,count]:any, i:number) => {
              const max = data.pareto[0][1]
              const pct = Math.round(count/max*100)
              const colors = ['var(--rd)','var(--am)','var(--cy)','var(--gn)','var(--t2)']
              return (
                <div key={name} className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs">{i+1}. {name}</div>
                    <div className="text-xs font-bold" style={{color:colors[i]}}>{count}x</div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{background:'var(--s2)'}}>
                    <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:colors[i]}}/>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Calendar OS */}
      <div className="flex items-center justify-between mb-2">
        <SH label="Calendário de OS" />
        <div className="flex items-center gap-2">
          <button onClick={()=>setCalMonth(m=>{const d=new Date(m);d.setMonth(d.getMonth()-1);return d})} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'16px'}}>‹</button>
          <span className="text-xs font-bold" style={{color:'var(--t1)'}}>{MFULL[calMonth.getMonth()]} {calMonth.getFullYear()}</span>
          <button onClick={()=>setCalMonth(m=>{const d=new Date(m);d.setMonth(d.getMonth()+1);return d})} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:'16px'}}>›</button>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        <div className="grid grid-cols-7">
          {['D','S','T','Q','Q','S','S'].map((d,i)=>(
            <div key={i} className="text-center py-1.5 text-xs font-bold" style={{color:'var(--t3)',borderBottom:'1px solid var(--bd)'}}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calDays().map((day,i)=>{
            if (!day) return <div key={i} className="p-1 min-h-8"/>
            const ds = `${calMonth.getFullYear()}-${String(calMonth.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const dayOS = getOSForDate(ds)
            const isToday = ds === today
            return (
              <div key={i} onClick={()=>dayOS.length&&onNavigate('os')} className="p-1 min-h-8 text-center" style={{borderRight:'1px solid var(--bd)',borderBottom:'1px solid var(--bd)',cursor:dayOS.length?'pointer':'default',background:isToday?'rgba(0,212,255,.08)':'transparent'}}>
                <div className="text-xs mb-0.5" style={{color:isToday?'var(--cy)':'var(--t2)',fontWeight:isToday?700:400}}>{day}</div>
                {dayOS.slice(0,2).map((o:any,j:number)=>(
                  <div key={j} className="w-full h-1 rounded-sm mb-0.5" style={{background:o.status==='done'?'var(--gn)':o.status==='progress'?'var(--am)':'var(--cy)'}}/>
                ))}
                {dayOS.length>2&&<div style={{fontSize:'7px',color:'var(--t3)'}}>+{dayOS.length-2}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Today's OS */}
      <SH label="OS de Hoje" action={
        <div className="flex gap-1.5">
          {todayIsWeekend&&<button onClick={()=>onNavigate('os')} className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(167,139,250,.2)',color:'#a78bfa',border:'1px solid rgba(167,139,250,.4)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>🗓️ Fim Sem.</button>}
          <button onClick={()=>onNavigate('os')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--cy)',color:'#000',border:'none',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>+ Nova OS</button>
        </div>
      } />
      {data.recentOS?.length ? (
        <div className="flex flex-col gap-1.5 mb-3">
          {data.recentOS.map((o:any)=>{
            const st=STATUS_INFO[o.status]||STATUS_INFO.open
            const late=o.due_date&&o.due_date<today&&o.status!=='done'
            return (
              <div key={o.id} onClick={()=>onNavigate('os')} className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:`1px solid ${late?'rgba(239,68,68,.4)':'var(--bd)'}`}}>
                <span className="text-base">{late?'🔴':'📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{o.number} — {o.title}</div>
                  <div className="text-xs" style={{color:'var(--t2)'}}>⚙️ {o.machine_name||'—'} · <span style={{color:st.color}}>{st.label}</span></div>
                </div>
              </div>
            )
          })}
        </div>
      ) : <Empty icon="📋" text="Nenhuma OS para hoje" />}

      {/* Today's tasks */}
      <SH label="Tarefas de Hoje" action={<button onClick={()=>onNavigate('tasks')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--cy)',color:'#000',border:'none',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>+ Nova</button>} />
      {data.todayTasks?.length ? (
        <div className="flex flex-col gap-1.5 mb-3">
          {data.todayTasks.map((t:any)=>(
            <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)',opacity:t.done?.6:1}}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs" style={{background:t.done?'var(--gn)':'transparent',border:`2px solid ${t.done?'var(--gn)':'var(--bd2)'}`,color:'#fff',flexShrink:0}}>{t.done&&'✓'}</div>
              <div className="text-xs font-medium flex-1 truncate" style={{textDecoration:t.done?'line-through':''}}>{t.title}</div>
              {t.owner_name&&<div className="text-xs" style={{color:'var(--t3)'}}>👤 {t.owner_name}</div>}
            </div>
          ))}
        </div>
      ) : <Empty icon="✅" text="Nenhuma tarefa hoje" />}

      {/* Recent maintenance */}
      <SH label="Últimas Manutenções" action={<button onClick={()=>onNavigate('pm')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--s2)',color:'var(--t2)',border:'1px solid var(--bd)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>Ver MP</button>} />
      {data.recentMaint?.length ? (
        <div className="flex flex-col gap-1.5">
          {data.recentMaint.map((m:any)=>(
            <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <span className="text-base">🔧</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{m.machine_name||'Máquina'} — {m.type}</div>
                <div className="text-xs" style={{color:'var(--t2)'}}>👤 {m.resp} · 📅 {fmtD(m.date)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty icon="🔧" text="Nenhuma manutenção registrada" />}
    </div>
  )
}
