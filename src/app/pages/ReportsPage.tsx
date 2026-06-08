'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SH, Card } from '@/components/ui'
import { fmtD, STATUS_INFO } from '@/lib/utils'
import { pdfOS, pdfMaint, pdfParts } from '@/lib/pdf'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

export default function ReportsPage({ profile, can }: Props) {
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoad]   = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const today = new Date().toISOString().split('T')[0]
    const [os, maint, parts, pm] = await Promise.all([
      supabase.from('work_orders').select('*'),
      supabase.from('maintenance').select('*'),
      supabase.from('parts').select('*'),
      supabase.from('pm_reports').select('*'),
    ])
    const osList = os.data||[]
    const pList = parts.data||[]
    setSummary({
      osTotal: osList.length,
      osOpen: osList.filter((o:any)=>o.status==='open').length,
      osDone: osList.filter((o:any)=>o.status==='done').length,
      osOverdue: osList.filter((o:any)=>o.due_date&&o.due_date<today&&o.status!=='done'&&o.status!=='cancelled').length,
      maintTotal: (maint.data||[]).length,
      partsLow: pList.filter((p:any)=>p.stock<=p.min_stock).length,
      pmTotal: (pm.data||[]).length,
      os: osList, maint: maint.data||[], parts: pList,
    })
    setLoad(false)
  }

  async function genOS() {
    toast.loading('Gerando PDF...', { id:'pdf' })
    try {
      await pdfOS(summary.os||[], { title:'Relatório de Ordens de Serviço', user: profile?.display_name||'' })
      toast.success('PDF gerado!', { id:'pdf' })
    } catch(e:any) { toast.error('Erro: '+e.message, {id:'pdf'}) }
  }

  async function genMaint() {
    toast.loading('Gerando PDF...', { id:'pdf' })
    try {
      await pdfMaint(summary.maint||[], { title:'Histórico de Manutenção', user: profile?.display_name||'' })
      toast.success('PDF gerado!', { id:'pdf' })
    } catch(e:any) { toast.error('Erro: '+e.message, {id:'pdf'}) }
  }

  async function genParts() {
    toast.loading('Gerando PDF...', { id:'pdf' })
    try {
      await pdfParts(summary.parts||[], { title:'Inventário de Peças', user: profile?.display_name||'' })
      toast.success('PDF gerado!', { id:'pdf' })
    } catch(e:any) { toast.error('Erro: '+e.message, {id:'pdf'}) }
  }

  async function exportJSON() {
    const [os, maint, mach, parts, pm, tasks] = await Promise.all([
      supabase.from('work_orders').select('*'),
      supabase.from('maintenance').select('*'),
      supabase.from('machines').select('*'),
      supabase.from('parts').select('*'),
      supabase.from('pm_reports').select('*'),
      supabase.from('tasks').select('*'),
    ])
    const data = { _date: new Date().toISOString(), _version: 3, work_orders: os.data, maintenance: maint.data, machines: mach.data, parts: parts.data, pm_reports: pm.data, tasks: tasks.data }
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`backup_${new Date().toISOString().split('T')[0]}.json`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup exportado ✅')
  }

  if (loading) return <div className="text-center py-10" style={{color:'var(--t3)'}}>⚙️ Carregando...</div>

  const stats = [
    { label:'OS Total',    value: summary.osTotal||0,   color:'blue'  },
    { label:'Abertas',     value: summary.osOpen||0,    color:'amber' },
    { label:'Concluídas',  value: summary.osDone||0,    color:'green' },
    { label:'Atrasadas',   value: summary.osOverdue||0, color:'red'   },
    { label:'Manutenções', value: summary.maintTotal||0,color:'blue'  },
    { label:'Peças Baixo', value: summary.partsLow||0,  color:'amber' },
    { label:'Relatórios MP',value: summary.pmTotal||0,  color:'green' },
  ]

  const reports = [
    { icon:'📋', title:'Ordens de Serviço', desc:'Todas as OS com status e prioridade', badge:'PDF', fn: genOS },
    { icon:'🔧', title:'Histórico Manutenção', desc:'Todas as manutenções por máquina', badge:'PDF', fn: genMaint },
    { icon:'📦', title:'Inventário de Peças', desc:'Estoque atual com alertas de mínimo', badge:'PDF', fn: genParts },
    { icon:'💾', title:'Backup Completo', desc:'Exportar todos os dados em JSON', badge:'JSON', fn: exportJSON },
  ]

  return (
    <div>
      {/* Summary KPIs */}
      <SH label="Resumo Geral" />
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {stats.slice(0,4).map(s => (
          <div key={s.label} className="rounded-xl p-2 text-center relative overflow-hidden" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div className="absolute top-0 inset-x-0 h-0.5" style={{background:s.color==='blue'?'var(--cy)':s.color==='green'?'var(--gn)':s.color==='amber'?'var(--am)':'var(--rd)'}}/>
            <div className="font-bebas text-2xl" style={{color:s.color==='blue'?'var(--cy)':s.color==='green'?'var(--gn)':s.color==='amber'?'var(--am)':'var(--rd)'}}>{s.value}</div>
            <div style={{fontSize:'8px',color:'var(--t3)',textTransform:'uppercase'}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Reports */}
      <SH label="Gerar Relatórios" />
      <div className="grid grid-cols-2 gap-2 mb-4">
        {reports.map(r => (
          <div key={r.title} onClick={r.fn} className="rounded-xl p-3 cursor-pointer transition-all flex flex-col" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--cy)';(e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--bd)';(e.currentTarget as HTMLElement).style.transform='none'}}>
            <div className="text-2xl mb-1.5">{r.icon}</div>
            <div className="text-xs font-bold leading-tight">{r.title}</div>
            <div className="text-xs mt-1 flex-1" style={{color:'var(--t2)',lineHeight:1.4}}>{r.desc}</div>
            <div className="mt-2 self-start px-2 py-0.5 rounded-lg text-xs font-bold" style={{background:'rgba(0,212,255,.12)',color:'var(--cy)'}}>{r.badge}</div>
          </div>
        ))}
      </div>

      {/* Indicators */}
      <SH label="Indicadores" />
      <div className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        {[
          ['Manutenções Registradas', summary.maintTotal||0, 'var(--cy)'],
          ['Relatórios MP', summary.pmTotal||0, 'var(--gn)'],
          ['Peças com Estoque Baixo', summary.partsLow||0, summary.partsLow>0?'var(--am)':'var(--gn)'],
        ].map(([label,val,color]) => (
          <div key={String(label)} className="flex items-center justify-between py-2.5" style={{borderBottom:'1px solid var(--bd)'}}>
            <span className="text-xs" style={{color:'var(--t2)'}}>{String(label)}</span>
            <span className="text-sm font-bold" style={{color:String(color)}}>{String(val)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-xs" style={{color:'var(--t2)'}}>Taxa de Conclusão de OS</span>
          <span className="text-sm font-bold" style={{color:'var(--gn)'}}>
            {summary.osTotal ? Math.round(summary.osDone/summary.osTotal*100) : 0}%
          </span>
        </div>
      </div>
    </div>
  )
}
