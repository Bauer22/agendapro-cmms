'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SH, Empty, Badge } from '@/components/ui'
import { fmtD } from '@/lib/utils'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean; onNavigate:(p:any)=>void }

export default function QRPage({ profile, can, onNavigate }: Props) {
  const [machines, setMachines] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [history, setHistory]   = useState<any[]>([])
  const [osHistory, setOsHistory] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('qr')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('machines').select('*').order('name')
    setMachines(data||[])
    setLoading(false)
  }

  async function selectMachine(m: any) {
    setSelected(m)
    setTab('history')
    const [maint, os] = await Promise.all([
      supabase.from('maintenance').select('*').eq('machine_id', m.id).order('date',{ascending:false}).limit(20),
      supabase.from('work_orders').select('*').eq('machine_id', m.id).order('created_at',{ascending:false}).limit(20),
    ])
    setHistory(maint.data||[])
    setOsHistory(os.data||[])
  }

  function generateQRUrl(machineId: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}?machine=${machineId}`)}`
  }

  async function printQR(m: any) {
    const url = generateQRUrl(m.id)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR Code - ${m.name}</title>
      <style>body{font-family:system-ui;text-align:center;padding:40px;background:#fff}
      .card{border:2px solid #000;border-radius:12px;padding:24px;display:inline-block;max-width:280px}
      h2{margin:8px 0;font-size:18px}p{margin:4px 0;color:#555;font-size:12px}
      img{border-radius:8px}</style></head>
      <body><div class="card">
        <div style="font-size:32px">${m.icon||'⚙️'}</div>
        <h2>${m.name}</h2>
        <p>${m.code||''} · ${m.location||m.sector||''}</p>
        <img src="${url}" width="200" height="200" style="margin:16px 0"/>
        <p>Escaneie para acessar o histórico</p>
        <p style="font-size:10px;color:#999">Industrial8</p>
      </div><script>window.print()</script></body></html>
    `)
    win.document.close()
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1.5 mb-3">
        {[{k:'qr',l:'📱 QR Codes'},{k:'history',l:`📋 Histórico${selected?` — ${selected.name}`:''}`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:tab===t.k?'var(--cy)':'transparent',color:tab===t.k?'#000':'var(--t2)',borderColor:tab===t.k?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='qr' && (
        <>
          <div className="rounded-xl p-3 mb-3" style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)'}}>
            <div className="text-xs font-bold mb-1" style={{color:'var(--cy)'}}>📱 Como usar o QR Code</div>
            <div className="text-xs" style={{color:'var(--t2)',lineHeight:1.6}}>
              1. Clique em uma máquina para gerar o QR Code<br/>
              2. Clique em 🖨️ para imprimir e colar na máquina<br/>
              3. Qualquer técnico escaneia e acessa o histórico instantaneamente
            </div>
          </div>
          <SH label={`Máquinas (${machines.length})`} />
          {loading?<div className="text-center py-8" style={{color:'var(--t3)'}}>Carregando...</div>:
          machines.length===0?<Empty icon="⚙️" text="Nenhuma máquina"/>:(
            <div className="grid grid-cols-2 gap-2">
              {machines.map(m=>(
                <div key={m.id} className="rounded-xl p-3 cursor-pointer" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}
                  onClick={()=>selectMachine(m)}>
                  <div className="text-2xl mb-1">{m.icon||'⚙️'}</div>
                  <div className="text-xs font-bold">{m.name}</div>
                  <div className="text-xs font-mono mt-0.5" style={{color:'var(--t3)'}}>{m.code}</div>
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={e=>{e.stopPropagation();selectMachine(m)}}
                      className="flex-1 py-1 rounded-lg text-xs cursor-pointer"
                      style={{background:'rgba(0,212,255,.12)',color:'var(--cy)',border:'1px solid rgba(0,212,255,.2)',fontFamily:'Sora,system-ui,sans-serif',fontWeight:700}}>
                      📋 Histórico
                    </button>
                    <button onClick={e=>{e.stopPropagation();printQR(m)}}
                      className="py-1 px-2 rounded-lg text-xs cursor-pointer"
                      style={{background:'var(--s2)',color:'var(--t2)',border:'1px solid var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>
                      🖨️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab==='history' && selected && (
        <>
          <div className="flex items-center gap-3 p-3 rounded-xl mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div className="text-3xl">{selected.icon||'⚙️'}</div>
            <div>
              <div className="text-sm font-bold">{selected.name}</div>
              <div className="text-xs font-mono" style={{color:'var(--t3)'}}>{selected.code} · {selected.location||selected.sector}</div>
            </div>
            <button onClick={()=>printQR(selected)} className="ml-auto text-xs px-3 py-1.5 rounded-xl font-bold cursor-pointer"
              style={{background:'var(--cy)',color:'#000',border:'none',fontFamily:'Sora,system-ui,sans-serif'}}>
              🖨️ Imprimir QR
            </button>
          </div>

          {/* QR Code display */}
          <div className="text-center mb-3 p-4 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <img src={generateQRUrl(selected.id)} alt="QR Code" className="mx-auto rounded-xl" style={{width:160,height:160}} />
            <div className="text-xs mt-2" style={{color:'var(--t3)'}}>Escaneie para acessar esta máquina</div>
          </div>

          {/* Maintenance history */}
          <SH label={`Manutenções (${history.length})`} />
          {history.length===0?<Empty icon="🔧" text="Sem manutenções registradas"/>:(
            <div className="flex flex-col gap-2 mb-3">
              {history.map(r=>(
                <div key={r.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold">{r.type}</div>
                    <div className="text-xs" style={{color:'var(--t3)'}}>{fmtD(r.date)}</div>
                  </div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>👤 {r.resp}{r.duration&&` · ⏱️ ${r.duration}h`}</div>
                  {r.description&&<div className="text-xs mt-1" style={{color:'var(--t3)'}}>{r.description.slice(0,60)}</div>}
                </div>
              ))}
            </div>
          )}

          {/* OS History */}
          <SH label={`Ordens de Serviço (${osHistory.length})`} />
          {osHistory.length===0?<Empty icon="📋" text="Sem OS registradas"/>:(
            <div className="flex flex-col gap-2">
              {osHistory.map(o=>(
                <div key={o.id} className="p-2.5 rounded-xl" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold">{o.number} — {o.title}</div>
                    <Badge color={o.status==='done'?'green':o.status==='progress'?'amber':'blue'}>{o.status==='done'?'Concluída':o.status==='progress'?'Andamento':'Aberta'}</Badge>
                  </div>
                  <div className="text-xs mt-0.5" style={{color:'var(--t2)'}}>📅 {fmtD(o.open_date)} · 👤 {o.resp_name||'—'}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab==='history' && !selected && (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📱</div>
          <div className="text-xs" style={{color:'var(--t3)'}}>Selecione uma máquina na aba QR Codes</div>
        </div>
      )}
    </div>
  )
}
