'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// PainelProducaoDia — painel de produção do dia para o Dashboard.
// - Atualiza sozinho a cada 5 minutos + botão "Atualizar agora".
// - KPIs do dia (pacotes, m³, tempo médio entre pacotes).
// - Gráfico: produção (m³) por dia na semana.
// - Gráfico: tempo médio (min) entre pacotes por dia na semana.
// ═══════════════════════════════════════════════════════════════

const m3fmt = (v:number) => (v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const REFRESH_MS = 5 * 60 * 1000

function diaISO(d:Date){ return d.toISOString().split('T')[0] }
function labelDia(iso:string){ const [,,dd]=iso.split('-'); const dt=new Date(iso+'T00:00:00'); const w=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dt.getDay()]; return `${w} ${dd}` }

export default function PainelProducaoDia() {
  const [pacotesHoje, setPacotesHoje] = useState<any[]>([])
  const [semana, setSemana] = useState<any[]>([])   // {dia, total_m3, media_min}
  const [ultima, setUltima] = useState<Date|null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const hoje = diaISO(new Date())
    const ini = diaISO(new Date(Date.now() - 6*86400000))  // últimos 7 dias
    const [ph, ps] = await Promise.all([
      supabase.from('producao_pacotes').select('*').eq('dia',hoje).order('created_at',{ascending:true}),
      supabase.from('producao_pacotes').select('dia,volume_m3,created_at').gte('dia',ini).lte('dia',hoje),
    ])
    setPacotesHoje(ph.data||[])

    // agrega por dia
    const byDia:Record<string,{total:number;times:number[]}> = {}
    ;(ps.data||[]).forEach((p:any)=>{
      const k=p.dia
      if(!byDia[k]) byDia[k]={total:0,times:[]}
      byDia[k].total += (+p.volume_m3||0)
      if(p.created_at) byDia[k].times.push(new Date(p.created_at).getTime())
    })
    const dias:any[]=[]
    for(let i=6;i>=0;i--){
      const k=diaISO(new Date(Date.now()-i*86400000))
      const b=byDia[k]
      let media:number|null=null
      if(b && b.times.length>1){
        b.times.sort((a,b2)=>a-b2)
        media = ((b.times[b.times.length-1]-b.times[0])/60000)/(b.times.length-1)
      }
      dias.push({ dia:k, total_m3:b?b.total:0, media_min:media })
    }
    setSemana(dias)
    setUltima(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  // KPIs do dia
  const qtd = pacotesHoje.length
  const totalM3 = pacotesHoje.reduce((s,p)=>s+(+p.volume_m3||0),0)
  const times = pacotesHoje.filter(p=>p.created_at).map(p=>new Date(p.created_at).getTime()).sort((a,b)=>a-b)
  const mediaMin = times.length>1 ? ((times[times.length-1]-times[0])/60000)/(times.length-1) : null

  const Bar = ({dados, valorDe, fmt, cor}:{dados:any[];valorDe:(d:any)=>number;fmt:(d:any)=>string;cor:string}) => {
    const max = Math.max(1, ...dados.map(valorDe))
    return (
      <div style={{display:'flex',alignItems:'flex-end',gap:'6px',height:'110px',padding:'4px 2px'}}>
        {dados.map((d,i)=>{
          const v=valorDe(d)
          const h=Math.round((v/max)*90)
          return (
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
              <div style={{fontSize:'8px',color:'var(--t2)'}}>{v>0?fmt(d):''}</div>
              <div title={fmt(d)} style={{width:'100%',height:`${h}px`,minHeight:v>0?'3px':'0',background:cor,borderRadius:'4px 4px 0 0'}}/>
              <div style={{fontSize:'8px',color:'var(--t3)'}}>{labelDia(d.dia)}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid rgba(249,115,22,.25)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <div style={{fontSize:'11px',fontWeight:700,color:'#f97316',textTransform:'uppercase',letterSpacing:'1px'}}>🏭 Produção de hoje</div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          {ultima && <span style={{fontSize:'9px',color:'var(--t3)'}}>Atualizado {ultima.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>}
          <button onClick={load} disabled={loading}
            style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'8px',padding:'5px 10px',color:'var(--cy)',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>
            {loading?'⏳':'🔄'} Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        <div style={{flex:1,textAlign:'center',background:'var(--s2)',borderRadius:'10px',padding:'8px'}}>
          <div style={{fontSize:'9px',color:'var(--t3)'}}>Pacotes hoje</div>
          <div style={{fontSize:'20px',fontWeight:800,color:'var(--t1)'}}>{qtd}</div>
        </div>
        <div style={{flex:1,textAlign:'center',background:'var(--s2)',borderRadius:'10px',padding:'8px'}}>
          <div style={{fontSize:'9px',color:'var(--t3)'}}>m³ hoje</div>
          <div style={{fontSize:'20px',fontWeight:800,color:'var(--gn)'}}>{m3fmt(totalM3)}</div>
        </div>
        <div style={{flex:1,textAlign:'center',background:'var(--s2)',borderRadius:'10px',padding:'8px'}}>
          <div style={{fontSize:'9px',color:'var(--t3)'}}>Média min/pacote</div>
          <div style={{fontSize:'20px',fontWeight:800,color:'var(--cy)'}}>{mediaMin!=null?mediaMin.toFixed(1):'—'}</div>
        </div>
      </div>

      {/* Gráfico produção semanal */}
      <div style={{fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'2px'}}>Produção por dia (m³) — 7 dias</div>
      <Bar dados={semana} valorDe={(d)=>d.total_m3} fmt={(d)=>m3fmt(d.total_m3)} cor="#22c55e" />

      {/* Gráfico tempo médio entre pacotes */}
      <div style={{fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',margin:'8px 0 2px'}}>Tempo médio entre pacotes (min) — 7 dias</div>
      <Bar dados={semana} valorDe={(d)=>d.media_min||0} fmt={(d)=>d.media_min!=null?d.media_min.toFixed(0):'—'} cor="#38bdf8" />
    </div>
  )
}
