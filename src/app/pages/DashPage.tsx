'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { KPI, SH, Card, Empty } from '@/components/ui'
import { fmtD, fmtDT, STATUS_INFO, PRIO_COLOR, oilStatus } from '@/lib/utils'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean; onNavigate:(p:any)=>void }

export default function DashPage({ profile, can, onNavigate }: Props) {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [os, mach, maint, tasks, parts, bills] = await Promise.all([
        supabase.from('work_orders').select('*'),
        supabase.from('machines').select('*'),
        supabase.from('maintenance').select('*').order('date',{ascending:false}).limit(5),
        supabase.from('tasks').select('*').eq('date', new Date().toISOString().split('T')[0]),
        supabase.from('parts').select('*').filter('stock','lte','min_stock'),
        supabase.from('accounts_payable').select('valor,status,due_date'),
      ])
      const today = new Date().toISOString().split('T')[0]
      const osList = os.data || []
      const machList = mach.data || []
      const alerts: any[] = []

      // Build alerts from machines
      machList.forEach((m:any) => {
        if (m.category === 'transport' && m.oil_interval) {
          const st = oilStatus(m.current_hours||0, m.last_oil_hours||0, m.oil_interval)
          if (st.color !== 'gn') alerts.push({ level: st.color, icon: m.icon||'⚙️', title: `${m.name} — Troca de Óleo`, sub: st.label })
        }
      })

      // Overdue OS
      osList.filter((o:any) => o.due_date && o.due_date < today && o.status !== 'done' && o.status !== 'cancelled')
        .forEach((o:any) => alerts.push({ level:'rd', icon:'📋', title:`OS ${o.number} — ${o.title}`, sub:`Atrasada desde ${fmtD(o.due_date)}` }))

      // Low stock
      ;(parts.data||[]).forEach((p:any) => alerts.push({ level:'am', icon:'📦', title:`${p.name} — Estoque baixo`, sub:`${p.stock} ${p.unit} (mín: ${p.min_stock})` }))

      const billList = bills.data||[]
        const today2 = new Date().toISOString().split('T')[0]
        const pendingBills = billList.filter((b:any)=>b.status==='pending').length
        const overdueBills = billList.filter((b:any)=>b.status==='pending'&&b.due_date&&b.due_date<today2).length
        setData({
        osOpen:    osList.filter((o:any)=>o.status==='open').length,
        osProgress:osList.filter((o:any)=>o.status==='progress').length,
        osDone:    osList.filter((o:any)=>o.status==='done').length,
        osOverdue: osList.filter((o:any)=>o.due_date&&o.due_date<today&&o.status!=='done'&&o.status!=='cancelled').length,
        machines:  machList.length,
        alerts:    alerts.sort((a:any,b:any)=>a.level==='rd'?-1:1).slice(0,6),
        recentOS:  osList.filter((o:any)=>o.open_date===today||o.status==='progress').slice(0,5),
        todayTasks:(tasks.data||[]),
        recentMaint:(maint.data||[]),
          pendingBills, overdueBills,
      })
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="text-center py-10" style={{color:'var(--t3)'}}>⚙️ Carregando...</div>

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <KPI num={data.osOpen||0}    label="OS Abertas"    color="blue"  />
        <KPI num={data.osProgress||0} label="Em Andamento" color="amber" />
        <KPI num={data.osDone||0}    label="Concluídas"    color="green" />
        <KPI num={data.osOverdue||0} label="Atrasadas"     color={data.osOverdue>0?'red':'green'} />
      </div>

      {/* Alerts */}
      <SH label="Alertas Críticos" action={<button onClick={()=>onNavigate('machines')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--cy)',color:'#000',border:'none',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>Ver Máquinas</button>} />
      {data.alerts?.length ? (
        <div className="flex flex-col gap-1.5 mb-3">
          {data.alerts.map((a:any, i:number) => (
            <div key={i} onClick={()=>onNavigate('os')} className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer"
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
          <div className="text-xs font-semibold">Tudo em dia! Nenhum alerta crítico.</div>
        </div>
      )}

      {/* Today's OS */}
      <SH label="OS de Hoje" action={<button onClick={()=>onNavigate('os')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--cy)',color:'#000',border:'none',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>+ Nova OS</button>} />
      {data.recentOS?.length ? (
        <div className="flex flex-col gap-1.5 mb-3">
          {data.recentOS.map((o:any) => {
            const st = STATUS_INFO[o.status] || STATUS_INFO.open
            const late = o.due_date && o.due_date < new Date().toISOString().split('T')[0] && o.status !== 'done'
            return (
              <div key={o.id} onClick={()=>onNavigate('os')} className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer" style={{background:'var(--s1)',border:`1px solid ${late?'rgba(239,68,68,.4)':'var(--bd)'}`}}>
                <span className="text-base">{late?'🔴':'📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{o.number} — {o.title}</div>
                  <div className="text-xs" style={{color:'var(--t2)'}}>⚙️ {o.machine_name||'—'} · <span style={{color:st.color}}>{st.label}</span>{late?' · ⚠️ Atrasada':''}</div>
                </div>
              </div>
            )
          })}
        </div>
      ) : <Empty icon="📋" text="Nenhuma OS para hoje" />}

      {/* Today's Tasks */}
      <SH label="Tarefas de Hoje" action={<button onClick={()=>onNavigate('tasks')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--cy)',color:'#000',border:'none',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>+ Nova</button>} />
      {data.todayTasks?.length ? (
        <div className="flex flex-col gap-1.5 mb-3">
          {data.todayTasks.map((t:any) => (
            <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)',opacity:t.done?.6:1}}>
              <div className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-xs" style={{background:t.done?'var(--gn)':'transparent',border:`2px solid ${t.done?'var(--gn)':'var(--bd2)'}`,color:'#fff'}}>
                {t.done&&'✓'}
              </div>
              <div className="text-xs font-medium flex-1 truncate" style={{textDecoration:t.done?'line-through':''}}>{t.title}</div>
              {t.owner_name && <div className="text-xs" style={{color:'var(--t3)'}}>👤 {t.owner_name}</div>}
            </div>
          ))}
        </div>
      ) : <Empty icon="✅" text="Nenhuma tarefa hoje" />}

      {/* Recent Maintenance */}
      <SH label="Últimas Manutenções" action={<button onClick={()=>onNavigate('maintenance')} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--s2)',color:'var(--t2)',border:'1px solid var(--bd)',cursor:'pointer',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>Ver todas</button>} />
      {data.recentMaint?.length ? (
        <div className="flex flex-col gap-1.5">
          {data.recentMaint.map((m:any) => (
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
