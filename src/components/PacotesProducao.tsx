'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Input, Empty, useConfirm } from '@/components/ui'
import { td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

// ═══════════════════════════════════════════════════════════════
// PacotesProducao — lançamento da produção POR GRADE (4 tipos na tela)
//
// Cada tipo (Capa, Capinha, Retalho, Aproveitamento) tem na própria tela:
//   cabeçalho + grade de linhas + botão "+ Lançamento".
// Cada linha vira um pacote ao salvar.
//
// Fórmulas (dimensões em metros; espessura digitada em MM):
//   capa/capinha        = folhas × comprimento × largura × (espessura_mm/1000)
//   retalho/aproveitam.  = altura × comprimento × largura
// ═══════════════════════════════════════════════════════════════

const usaFolhas = (cat:string) => cat === 'capa' || cat === 'capinha'
const m3fmt = (v:number) => (v||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})
// aceita vírgula OU ponto (o operador digita 2,6)
const num = (v:any) => parseFloat(String(v==null?'':v).replace(',', '.')) || 0

// volume de uma linha da grade (espessura vem em MM → divide por 1000)
function volLinha(cat:string, l:any) {
  const larg = num(l.largura), comp = num(l.comprimento)
  if (usaFolhas(cat)) return num(l.folhas) * comp * larg * (num(l.espessura)/1000)
  return num(l.altura) * comp * larg
}

const TIPOS = [
  { cat:'capa',           label:'CAPA',           cor:'#22c55e' },
  { cat:'capinha',        label:'CAPINHA',        cor:'#3b82f6' },
  { cat:'retalho',        label:'RETALHO',        cor:'#f59e0b' },
  { cat:'aproveitamento', label:'APROVEITAMENTO', cor:'#a855f7' },
]

export default function PacotesProducao({ profile }: { profile: UserProfile|null }) {
  const [dia, setDia] = useState(td())
  const [cab, setCab] = useState<any>({ madeira:'', tanque_m3:'', sobra_m3:'' })
  const [pacotes, setPacotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  // grades por categoria
  const [grades, setGrades] = useState<Record<string,any[]>>({ capa:[], capinha:[], retalho:[], aproveitamento:[] })
  const { confirm, dialog } = useConfirm()

  useEffect(() => { loadDia() /* eslint-disable-next-line */ }, [dia])

  async function loadDia() {
    setLoading(true)
    const [c, p] = await Promise.all([
      supabase.from('producao_dia').select('*').eq('dia',dia).maybeSingle(),
      supabase.from('producao_pacotes').select('*').eq('dia',dia).order('numero',{ascending:false}),
    ])
    if (c.data) setCab({ madeira:c.data.madeira||'', tanque_m3:c.data.tanque_m3??'', sobra_m3:c.data.sobra_m3??'' })
    else setCab({ madeira:'', tanque_m3:'', sobra_m3:'' })
    setPacotes(p.data||[])
    setLoading(false)
  }

  async function salvarCabecalho() {
    const obj:any = {
      company_id: profile?.company_id||null, dia,
      madeira: cab.madeira||null,
      tanque_m3: cab.tanque_m3 ? parseFloat(cab.tanque_m3) : 0,
      sobra_m3: cab.sobra_m3 ? parseFloat(cab.sobra_m3) : 0,
      created_by: profile?.display_name||'',
    }
    const { error } = await supabase.from('producao_dia').upsert(obj, { onConflict:'company_id,dia' })
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Cabeçalho do dia salvo ✅')
  }

  const linhaVazia = ()=>({ espessura:'', comprimento:'', largura:'', folhas:'', altura:'' })

  // helpers de grade por categoria
  const setLin = (cat:string, i:number, campo:string, v:string)=>
    setGrades(g=>({...g, [cat]: g[cat].map((l,idx)=> idx===i?{...l,[campo]:v}:l)}))
  const addLinha = (cat:string)=> setGrades(g=>{
    const arr = g[cat]||[]
    const u = arr[arr.length-1] || {}
    return {...g, [cat]: [...arr, { espessura: u.espessura||'', comprimento: u.comprimento||'', largura: u.largura||'', folhas:'', altura:'' }]}
  })
  const delLinha = (cat:string, i:number)=> setGrades(g=>({...g, [cat]: g[cat].filter((_,idx)=>idx!==i)}))

  async function salvarCategoria(cat:string, imprimir:boolean) {
    const arr = grades[cat]||[]
    const validas = arr.filter(l=> volLinha(cat, l) > 0)
    if (validas.length===0) { toast.error('Preencha ao menos uma linha completa'); return }
    setSaving(cat)
    const salvos:any[] = []
    try {
      for (const l of validas) {
        const { data: num, error: eNum } = await supabase.rpc('fn_proximo_numero_pacote', { p_company_id: profile?.company_id||null })
        if (eNum) throw eNum
        const obj:any = {
          company_id: profile?.company_id||null, dia, numero: num, categoria: cat,
          tipo_lamina_id: null, tipo_nome: null,
          espessura: usaFolhas(cat) ? (num(l.espessura)/1000) : null,  // grava em metros
          largura: num(l.largura),
          comprimento: num(l.comprimento),
          altura: usaFolhas(cat) ? null : num(l.altura),
          folhas: usaFolhas(cat) ? num(l.folhas) : null,
          volume_m3: volLinha(cat, l),
          created_by: profile?.display_name||'',
        }
        const { data, error } = await supabase.from('producao_pacotes').insert(obj).select().single()
        if (error) throw error
        if (data) salvos.push(data)
      }
      toast.success(`${salvos.length} ${cat} lançado(s) ✅`)
      setGrades(g=>({...g, [cat]: []}))   // limpa a grade da categoria
      await loadDia()
      if (imprimir) salvos.forEach(p=>imprimirEtiqueta(p))
    } catch(e:any){ toast.error('Erro: '+e.message) }
    finally { setSaving('') }
  }

  async function del(id:string, numero:number) {
    if (!await confirm(`Excluir o pacote #${numero}?`)) return
    const { error } = await supabase.from('producao_pacotes').delete().eq('id',id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Excluído'); loadDia()
  }

  function imprimirEtiqueta(p:any) {
    const esc = (s:any)=>String(s==null?'':s).replace(/[&<>"']/g,(c:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
    const dim = usaFolhas(p.categoria)
      ? `${p.folhas} folhas · ${p.largura}×${p.comprimento}×${((p.espessura||0)*1000).toLocaleString('pt-BR')}mm`
      : `alt ${p.altura} · ${p.largura}×${p.comprimento} m`
    const html = `
      <html><head><title>Etiqueta Pacote</title>
      <style>@page{size:100mm 60mm;margin:4mm} body{font-family:Arial,sans-serif;margin:0;color:#000}</style>
      </head><body>
        <div style="border:2px solid #000;border-radius:6px;padding:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:12px;font-weight:bold">FAGANELLO — PACOTE</div>
            <div style="font-size:11px">${esc(new Date(p.dia+'T00:00:00').toLocaleDateString('pt-BR'))}</div>
          </div>
          <div style="font-size:34px;font-weight:900;text-align:center;letter-spacing:1px;margin:4px 0">Nº ${esc(String(p.numero).padStart(6,'0'))}</div>
          <div style="font-size:13px;text-align:center;text-transform:uppercase">${esc(p.categoria)}</div>
          <div style="font-size:11px;text-align:center;color:#333;margin-top:2px">${esc(dim)}</div>
          <div style="font-size:16px;font-weight:bold;text-align:center;margin-top:4px">${m3fmt(p.volume_m3)} m³</div>
        </div>
      </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),300) }
  }

  const totalM3 = pacotes.reduce((s,p)=>s+(+p.volume_m3||0),0)
  const tanqueLiq = (parseFloat(cab.tanque_m3)||0) - (parseFloat(cab.sobra_m3)||0)

  return (
    <div>
      {dialog}
      {/* Cabeçalho do dia */}
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid rgba(249,115,22,.25)'}}>
        <div style={{fontSize:'10px',fontWeight:700,color:'#f97316',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>📅 Produção do dia</div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Dia *" value={dia} onChange={setDia} type="date" />
          <Input label="Madeira do dia" value={cab.madeira} onChange={(v:string)=>setCab((e:any)=>({...e,madeira:v}))} placeholder="Ex: 18 a 24" />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="m³ do tanque" value={cab.tanque_m3} onChange={(v:string)=>setCab((e:any)=>({...e,tanque_m3:v}))} type="number" placeholder="0.000" />
          <Input label="Sobra do tanque (m³)" value={cab.sobra_m3} onChange={(v:string)=>setCab((e:any)=>({...e,sobra_m3:v}))} type="number" placeholder="0.000" />
        </div>
        <div style={{fontSize:'11px',color:'var(--cy)',fontWeight:700,marginBottom:'8px'}}>Tanque laminado: {m3fmt(tanqueLiq)} m³</div>
        <Btn onClick={salvarCabecalho} variant="primary" size="sm">💾 Salvar dados do dia</Btn>
      </div>

      {/* Seções por tipo de lâmina */}
      {TIPOS.map(t=> (
        <Secao key={t.cat} cat={t.cat} label={t.label} cor={t.cor}
          arr={grades[t.cat]||[]} saving={saving}
          setLin={setLin} addLinha={addLinha} delLinha={delLinha} salvarCategoria={salvarCategoria} />
      ))}

      {/* Resumo do dia */}
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s2)',border:'1px solid var(--bd)',display:'flex',justifyContent:'space-around',textAlign:'center'}}>
        <div><div style={{fontSize:'9px',color:'var(--t3)'}}>Pacotes</div><div style={{fontSize:'18px',fontWeight:800,color:'var(--t1)'}}>{pacotes.length}</div></div>
        <div><div style={{fontSize:'9px',color:'var(--t3)'}}>Total m³</div><div style={{fontSize:'18px',fontWeight:800,color:'var(--gn)'}}>{m3fmt(totalM3)}</div></div>
      </div>

      {/* Lista de pacotes do dia */}
      {loading ? <Empty icon="⏳" text="Carregando..." /> :
        pacotes.length===0 ? <Empty icon="📦" text="Nenhum pacote lançado neste dia." /> : (
        <div className="flex flex-col gap-2">
          {pacotes.map(p => (
            <div key={p.id} className="rounded-xl p-2 flex justify-between items-center" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:800,color:'var(--t1)'}}>
                  Nº {String(p.numero).padStart(6,'0')} <span style={{fontSize:'11px',fontWeight:600,color:'var(--cy)',textTransform:'uppercase'}}>· {p.categoria}</span>
                </div>
                <div style={{fontSize:'10px',color:'var(--t3)'}}>
                  {usaFolhas(p.categoria) ? `${p.folhas} folhas` : `alt ${p.altura}`} · <b style={{color:'var(--gn)'}}>{m3fmt(p.volume_m3)} m³</b>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={()=>imprimirEtiqueta(p)} style={{fontSize:'15px'}}>🏷️</button>
                <button onClick={()=>del(p.id,p.numero)} style={{color:'var(--rd)',fontSize:'15px'}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Seção de grade de uma categoria (componente de TOPO p/ não perder foco) ──
function Secao({ cat, label, cor, arr, saving, setLin, addLinha, delLinha, salvarCategoria }:{
  cat:string; label:string; cor:string; arr:any[]; saving:string;
  setLin:(cat:string,i:number,campo:string,v:string)=>void;
  addLinha:(cat:string)=>void; delLinha:(cat:string,i:number)=>void;
  salvarCategoria:(cat:string,imprimir:boolean)=>void;
}) {
  const total = arr.reduce((s,l)=> s + volLinha(cat, l), 0)
  const folhas = usaFolhas(cat)
  return (
    <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:`2px solid ${cor}`}}>
      <div style={{fontSize:'13px',fontWeight:800,color:cor,marginBottom:'8px'}}>{label}</div>

      {arr.length>0 && (
        folhas ? (
          <div className="grid gap-1 mb-1" style={{gridTemplateColumns:'18px 1fr 1fr 1fr 1fr 64px 20px'}}>
            <div style={hdr}>#</div><div style={hdr}>Esp(mm)</div><div style={hdr}>Comp</div><div style={hdr}>Larg</div><div style={hdr}>Folhas</div><div style={{...hdr,textAlign:'right'}}>m³</div><div></div>
            {arr.map((l,i)=>(
              <div key={i} style={{display:'contents'}}>
                <div style={cel}>{i+1}</div>
                <input style={inG} type="text" inputMode="decimal" value={l.espessura} onChange={e=>setLin(cat,i,'espessura',e.target.value)} placeholder="2,6" />
                <input style={inG} type="text" inputMode="decimal" value={l.comprimento} onChange={e=>setLin(cat,i,'comprimento',e.target.value)} />
                <input style={inG} type="text" inputMode="decimal" value={l.largura} onChange={e=>setLin(cat,i,'largura',e.target.value)} />
                <input style={inG} type="text" inputMode="numeric" value={l.folhas} onChange={e=>setLin(cat,i,'folhas',e.target.value)} />
                <div style={{...cel,textAlign:'right',color:'var(--gn)',fontWeight:700}}>{m3fmt(volLinha(cat,l))}</div>
                <button onClick={()=>delLinha(cat,i)} style={{color:'var(--rd)',fontSize:'13px'}}>✕</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-1 mb-1" style={{gridTemplateColumns:'18px 1fr 1fr 1fr 64px 20px'}}>
            <div style={hdr}>#</div><div style={hdr}>Altura</div><div style={hdr}>Comp</div><div style={hdr}>Larg</div><div style={{...hdr,textAlign:'right'}}>m³</div><div></div>
            {arr.map((l,i)=>(
              <div key={i} style={{display:'contents'}}>
                <div style={cel}>{i+1}</div>
                <input style={inG} type="text" inputMode="decimal" value={l.altura} onChange={e=>setLin(cat,i,'altura',e.target.value)} />
                <input style={inG} type="text" inputMode="decimal" value={l.comprimento} onChange={e=>setLin(cat,i,'comprimento',e.target.value)} />
                <input style={inG} type="text" inputMode="decimal" value={l.largura} onChange={e=>setLin(cat,i,'largura',e.target.value)} />
                <div style={{...cel,textAlign:'right',color:'var(--gn)',fontWeight:700}}>{m3fmt(volLinha(cat,l))}</div>
                <button onClick={()=>delLinha(cat,i)} style={{color:'var(--rd)',fontSize:'13px'}}>✕</button>
              </div>
            ))}
          </div>
        )
      )}

      <div className="flex items-center gap-2 flex-wrap mt-1">
        <Btn onClick={()=>addLinha(cat)} size="sm" style={{background:cor,color:'#fff',border:'none'}}>+ Lançamento</Btn>
        {arr.length>0 && <>
          <span style={{fontSize:'12px',fontWeight:800,color:'var(--gn)'}}>Total: {m3fmt(total)} m³</span>
          <Btn onClick={()=>salvarCategoria(cat,false)} size="sm" variant="secondary" disabled={saving===cat}>{saving===cat?'...':'💾 Salvar'}</Btn>
          <Btn onClick={()=>salvarCategoria(cat,true)} size="sm" variant="primary" disabled={saving===cat}>🏷️ Salvar + Etiquetas</Btn>
        </>}
      </div>
    </div>
  )
}

const hdr: React.CSSProperties = { fontSize:'8px', color:'var(--t3)', textTransform:'uppercase', fontWeight:700, padding:'2px' }
const cel: React.CSSProperties = { fontSize:'11px', color:'var(--t2)', display:'flex', alignItems:'center', justifyContent:'center' }
const inG: React.CSSProperties = { width:'100%', background:'#16284a', border:'1px solid var(--bd)', borderRadius:'6px', padding:'5px 6px', color:'#fff', fontSize:'11px', outline:'none' }
