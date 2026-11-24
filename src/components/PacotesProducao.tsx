'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Input, Modal, Empty, useConfirm } from '@/components/ui'
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
  const [aba, setAba] = useState<'lancamento'|'historico'>('lancamento')
  const [fechado, setFechado] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])
  const [editPacote, setEditPacote] = useState<any>(null)   // pacote em edição rápida
  const { confirm, dialog } = useConfirm()

  useEffect(() => { loadDia() /* eslint-disable-next-line */ }, [dia])
  useEffect(() => { if(aba==='historico') loadHistorico() /* eslint-disable-next-line */ }, [aba])

  async function loadHistorico() {
    const { data } = await supabase.from('producao_dia').select('*').order('dia',{ascending:false}).limit(120)
    // conta pacotes e soma m³ por dia
    const dias = (data||[]).map((d:any)=>d.dia)
    let resumo:Record<string,{qtd:number,m3:number}> = {}
    if (dias.length>0) {
      const { data: pk } = await supabase.from('producao_pacotes').select('dia,volume_m3').in('dia', dias)
      ;(pk||[]).forEach((p:any)=>{ const r = resumo[p.dia]||{qtd:0,m3:0}; r.qtd++; r.m3+=(+p.volume_m3||0); resumo[p.dia]=r })
    }
    setHistorico((data||[]).map((d:any)=>({ ...d, _qtd: resumo[d.dia]?.qtd||0, _m3: resumo[d.dia]?.m3||0 })))
  }

  async function fecharDia() {
    if (pacotes.length===0) { toast.error('Nenhum pacote lançado neste dia'); return }
    if (!await confirm('Fechar a produção deste dia? Ele vai para o histórico (você ainda pode editar por lá).')) return
    const { error } = await supabase.from('producao_dia').upsert({
      company_id: profile?.company_id||null, dia,
      madeira: cab.madeira||null, tanque_m3: cab.tanque_m3?num(cab.tanque_m3):0, sobra_m3: cab.sobra_m3?num(cab.sobra_m3):0,
      fechado: true, fechado_em: new Date().toISOString(), fechado_por: profile?.display_name||'',
    }, { onConflict:'company_id,dia' })
    if (error) { toast.error('Erro: '+error.message); return }
    setFechado(true)
    toast.success('Dia fechado ✅ (disponível no histórico)')
  }

  async function reabrirDiaNasGrades(diaAlvo:string) {
    setDia(diaAlvo)
    const { data: pk } = await supabase.from('producao_pacotes').select('*').eq('dia',diaAlvo)
    const g:Record<string,any[]> = { capa:[], capinha:[], retalho:[], aproveitamento:[] }
    ;(pk||[]).forEach((p:any)=>{
      const cat = p.categoria
      if (!g[cat]) g[cat]=[]
      g[cat].push({
        espessura: usaFolhas(cat) ? String(((p.espessura||0)*1000)) : '',
        comprimento: String(p.comprimento??''), largura: String(p.largura??''),
        folhas: usaFolhas(cat) ? String(p.folhas??'') : '', altura: usaFolhas(cat) ? '' : String(p.altura??''),
      })
    })
    setGrades(g)
    setAba('lancamento')
    toast('Dia carregado nas grades. Ao salvar, exclua os pacotes antigos se for refazer.', { icon:'ℹ️' })
  }

  // exclui um dia inteiro do histórico (pacotes + cabeçalho)
  async function excluirDia(h:any) {
    if (!await confirm(`Excluir TODA a produção do dia ${new Date(h.dia+'T00:00:00').toLocaleDateString('pt-BR')}? (${h._qtd} pacote(s)) Esta ação não pode ser desfeita.`)) return
    const q1 = await supabase.from('producao_pacotes').delete().eq('dia', h.dia)
    if (q1.error) { toast.error('Erro ao excluir pacotes: '+q1.error.message); return }
    await supabase.from('producao_dia').delete().eq('dia', h.dia)
    toast.success('Dia excluído')
    loadHistorico()
    if (dia===h.dia) loadDia()
  }

  async function salvarEdicaoPacote() {
    if (!editPacote) return
    const cat = editPacote.categoria
    const l = { espessura: editPacote._esp, comprimento: editPacote._comp, largura: editPacote._larg, folhas: editPacote._folhas, altura: editPacote._altura }
    const vol = volLinha(cat, l)
    if (vol<=0) { toast.error('Valores inválidos'); return }
    const { error } = await supabase.from('producao_pacotes').update({
      espessura: usaFolhas(cat) ? (num(editPacote._esp)/1000) : null,
      comprimento: num(editPacote._comp), largura: num(editPacote._larg),
      folhas: usaFolhas(cat) ? num(editPacote._folhas) : null,
      altura: usaFolhas(cat) ? null : num(editPacote._altura),
      volume_m3: vol,
    }).eq('id', editPacote.id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Pacote corrigido ✅')
    setEditPacote(null); loadDia()
  }

  async function loadDia() {
    setLoading(true)
    const [c, p] = await Promise.all([
      supabase.from('producao_dia').select('*').eq('dia',dia).maybeSingle(),
      supabase.from('producao_pacotes').select('*').eq('dia',dia).order('numero',{ascending:false}),
    ])
    if (c.data) { setCab({ madeira:c.data.madeira||'', tanque_m3:c.data.tanque_m3??'', sobra_m3:c.data.sobra_m3??'' }); setFechado(!!c.data.fechado) }
    else { setCab({ madeira:'', tanque_m3:'', sobra_m3:'' }); setFechado(false) }
    setPacotes(p.data||[])
    setLoading(false)
  }

  async function salvarCabecalho() {
    const obj:any = {
      company_id: profile?.company_id||null, dia,
      madeira: cab.madeira||null,
      tanque_m3: cab.tanque_m3 ? num(cab.tanque_m3) : 0,
      sobra_m3: cab.sobra_m3 ? num(cab.sobra_m3) : 0,
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
  // grava UM pacote no banco a partir de uma linha
  async function gravarPacote(cat:string, l:any) {
    const { data: numeroPacote, error: eNum } = await supabase.rpc('fn_proximo_numero_pacote', { p_company_id: profile?.company_id||null })
    if (eNum) throw eNum
    const obj:any = {
      company_id: profile?.company_id||null, dia, numero: numeroPacote, categoria: cat,
      tipo_lamina_id: null, tipo_nome: null,
      espessura: usaFolhas(cat) ? (num(l.espessura)/1000) : null,
      largura: num(l.largura), comprimento: num(l.comprimento),
      altura: usaFolhas(cat) ? null : num(l.altura),
      folhas: usaFolhas(cat) ? num(l.folhas) : null,
      volume_m3: volLinha(cat, l),
      created_by: profile?.display_name||'',
    }
    const { data, error } = await supabase.from('producao_pacotes').insert(obj).select().single()
    if (error) throw error
    return data
  }

  // + Lançamento: salva a última linha (se preenchida) e abre nova herdando medidas
  async function addLinha(cat:string) {
    const arr = grades[cat]||[]
    const u = arr[arr.length-1]
    // se a última linha está completa, salva ela antes de abrir a próxima
    if (u && volLinha(cat, u) > 0) {
      try {
        const p = await gravarPacote(cat, u)
        if (p) toast.success(`Pacote #${String(p.numero).padStart(6,'0')} salvo ✅`)
        // nova linha herda medidas; remove a que foi salva da grade (já está no banco)
        setGrades(g=>({...g, [cat]: [{ espessura: u.espessura||'', comprimento: u.comprimento||'', largura: u.largura||'', folhas:'', altura:'' }]}))
        await loadDia()
        return
      } catch(e:any){ toast.error('Erro ao salvar: '+e.message); return }
    }
    // sem linha preenchida: só adiciona (herda da última se houver)
    const base = u || {}
    setGrades(g=>({...g, [cat]: [...(g[cat]||[]), { espessura: base.espessura||'', comprimento: base.comprimento||'', largura: base.largura||'', folhas:'', altura:'' }]}))
  }
  const delLinha = (cat:string, i:number)=> setGrades(g=>({...g, [cat]: g[cat].filter((_,idx)=>idx!==i)}))

  async function salvarCategoria(cat:string, imprimir:boolean) {
    const arr = grades[cat]||[]
    const validas = arr.filter(l=> volLinha(cat, l) > 0)
    if (validas.length===0) { toast.error('Preencha ao menos uma linha completa'); return }
    setSaving(cat)
    const salvos:any[] = []
    try {
      for (const l of validas) {
        const data = await gravarPacote(cat, l)
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
  const tanqueLiq = (num(cab.tanque_m3)||0) - (num(cab.sobra_m3)||0)

  // ── Imprimir produção do dia (1 folha, colunas por tipo, estilo romaneio) ──
  async function imprimirProducaoDia() {
    if (pacotes.length===0) { toast.error('Nenhum pacote neste dia'); return }
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const { addLogoOnBand } = await import('@/lib/pdf')
      const doc = new jsPDF()
      const pageW = doc.internal.pageSize.getWidth()
      doc.setFillColor(6,13,26); doc.rect(0,0,pageW,22,'F')
      await addLogoOnBand(doc, 22)
      doc.setTextColor(249,115,22); doc.setFontSize(13); doc.setFont('helvetica','bold')
      doc.text('PRODUÇÃO DIÁRIA', 12, 10)
      doc.setTextColor(226,232,240); doc.setFontSize(8); doc.setFont('helvetica','normal')
      doc.text(`Data: ${new Date(dia+'T00:00:00').toLocaleDateString('pt-BR')}   Madeira: ${cab.madeira||'—'}   Tanque: ${m3fmt(num(cab.tanque_m3)||0)}   Sobra: ${m3fmt(num(cab.sobra_m3)||0)}   Laminado: ${m3fmt(tanqueLiq)} m³`, 12, 17)

      const marginL = 8, gap = 4
      const colW = (pageW - marginL*2 - gap) / 2
      const startY = 26
      const fs = 6.5

      // agrupa pacotes por categoria
      const porCat: Record<string,any[]> = { capa:[], capinha:[], retalho:[], aproveitamento:[] }
      pacotes.forEach(p=>{ if(!porCat[p.categoria]) porCat[p.categoria]=[]; porCat[p.categoria].push(p) })

      // desenha um grupo numa coluna, a partir de um Y
      const drawGrupo = (cat:string, label:string, x:number, y:number):number => {
        const arr = porCat[cat]||[]
        if (arr.length===0) return y
        const folhas = usaFolhas(cat)
        const tot = arr.reduce((s,p)=>s+(+p.volume_m3||0),0)
        const head = folhas ? [['Nº','Esp','Comp','Larg','Folhas','m³']] : [['Nº','Alt','Comp','Larg','m³']]
        const body = arr.map(p=> folhas
          ? [String(p.numero), String(((p.espessura||0)*1000).toLocaleString('pt-BR')), String(p.comprimento), String(p.largura), String(p.folhas), m3fmt(p.volume_m3)]
          : [String(p.numero), String(p.altura), String(p.comprimento), String(p.largura), m3fmt(p.volume_m3)])
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
        doc.text(label, x, y)
        autoTable(doc, {
          startY: y+2, margin:{left:x}, tableWidth: colW,
          head, body,
          foot: [folhas ? ['','','','','TOTAL', m3fmt(tot)] : ['','','','TOTAL', m3fmt(tot)]],
          theme:'grid',
          headStyles:{fillColor:[249,115,22],fontSize:fs,halign:'center',cellPadding:1},
          bodyStyles:{fontSize:fs,cellPadding:0.8,textColor:[20,20,20]},
          footStyles:{fillColor:[30,58,95],textColor:[255,255,255],fontSize:fs,halign:'right',cellPadding:1},
          styles:{lineColor:[160,160,160],lineWidth:0.1},
        })
        return (doc as any).lastAutoTable.finalY + 6
      }

      // coluna esquerda: CAPA + RETALHO | coluna direita: CAPINHA + APROVEITAMENTO
      const xL = marginL, xR = marginL + colW + gap
      let yL = startY, yR = startY
      yL = drawGrupo('capa', 'CAPA', xL, yL)
      yL = drawGrupo('retalho', 'RETALHO', xL, yL)
      yR = drawGrupo('capinha', 'CAPINHA', xR, yR)
      yR = drawGrupo('aproveitamento', 'APROVEITAMENTO', xR, yR)

      // rodapé: total geral
      let y = Math.max(yL, yR) + 4
      const pageH = doc.internal.pageSize.getHeight()
      if (y > pageH - 24) y = pageH - 24
      doc.setFillColor(249,115,22); doc.rect(marginL, y, pageW-marginL*2, 11, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont('helvetica','bold')
      doc.text(`TOTAL DO DIA  ·  ${pacotes.length} pacote(s)`, marginL+4, y+7.5)
      doc.text(m3fmt(totalM3)+' m³', pageW-marginL-4, y+7.5, {align:'right'})
      y += 17
      doc.setTextColor(60,60,60); doc.setFontSize(8); doc.setFont('helvetica','normal')
      doc.text('Responsável: ____________________________        Assinatura: ____________________________', marginL, y)

      doc.save(`producao_${dia}.pdf`)
      toast.success('Produção do dia gerada ✅')
    } catch(e:any){ toast.error('Erro ao gerar PDF: '+e.message) }
  }

  return (
    <div>
      {dialog}

      {/* Abas Lançamento / Histórico */}
      <div className="flex gap-1.5 mb-3">
        {[{k:'lancamento',l:'➕ Lançamento'},{k:'historico',l:'📚 Histórico'}].map(t=>(
          <button key={t.k} onClick={()=>setAba(t.k as any)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{background: aba===t.k?'var(--cy)':'var(--s1)', color: aba===t.k?'#061018':'var(--t2)', border:'1px solid var(--bd)'}}>{t.l}</button>
        ))}
      </div>

      {aba==='historico' ? (
        historico.length===0 ? <Empty icon="📚" text="Nenhum dia de produção registrado" />
        : <div className="flex flex-col gap-2">
            {historico.map(h=>(
              <div key={h.dia} className="p-3 rounded-xl flex justify-between items-center gap-3 flex-wrap" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div>
                  <b style={{color:'#fff',fontSize:'13px'}}>{new Date(h.dia+'T00:00:00').toLocaleDateString('pt-BR')}</b>
                  {h.fechado && <span style={{fontSize:'9px',color:'var(--gn)',marginLeft:'6px'}}>✓ fechado</span>}
                  <div style={{color:'var(--t2)',fontSize:'11px'}}>{h.madeira?`Madeira ${h.madeira} · `:''}{h._qtd} pacote(s)</div>
                </div>
                <div style={{textAlign:'right',fontSize:'11px',color:'var(--t2)'}}>
                  <b style={{color:'var(--gn)'}}>{m3fmt(h._m3)} m³</b>
                </div>
                <div className="flex gap-1.5">
                  <Btn onClick={()=>{ setDia(h.dia); setAba('lancamento') }} size="sm" variant="secondary">👁️ Abrir / Imprimir</Btn>
                  <Btn onClick={()=>reabrirDiaNasGrades(h.dia)} size="sm" variant="secondary">✏️ Reabrir</Btn>
                  <Btn onClick={()=>excluirDia(h)} size="sm" variant="danger">🗑️</Btn>
                </div>
              </div>
            ))}
          </div>
      ) : (
      <>
      {/* Cabeçalho do dia */}
      {fechado && (
        <div className="rounded-xl p-2 mb-2" style={{background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.3)',fontSize:'11px',color:'var(--gn)'}}>
          ✓ Este dia está fechado. Você ainda pode editar/excluir pacotes e lançar novos abaixo.
        </div>
      )}
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid rgba(249,115,22,.25)'}}>
        <div style={{fontSize:'10px',fontWeight:700,color:'#f97316',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>📅 Produção do dia</div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Dia *" value={dia} onChange={setDia} type="date" />
          <Input label="Madeira do dia" value={cab.madeira} onChange={(v:string)=>setCab((e:any)=>({...e,madeira:v}))} placeholder="Ex: 18 a 24" />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="m³ do tanque" value={cab.tanque_m3} onChange={(v:string)=>setCab((e:any)=>({...e,tanque_m3:v}))} type="text" inputMode="decimal" pattern="[0-9.,]*" placeholder="0.000" />
          <Input label="Sobra do tanque (m³)" value={cab.sobra_m3} onChange={(v:string)=>setCab((e:any)=>({...e,sobra_m3:v}))} type="text" inputMode="decimal" pattern="[0-9.,]*" placeholder="0.000" />
        </div>
        <div style={{fontSize:'11px',color:'var(--cy)',fontWeight:700,marginBottom:'8px'}}>Tanque laminado: {m3fmt(tanqueLiq)} m³</div>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={salvarCabecalho} variant="primary" size="sm">💾 Salvar dados do dia</Btn>
          <Btn onClick={fecharDia} variant="secondary" size="sm">🔒 Fechar dia</Btn>
          <Btn onClick={imprimirProducaoDia} variant="secondary" size="sm">🖨️ Imprimir produção</Btn>
        </div>
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
                <button onClick={()=>setEditPacote({ id:p.id, categoria:p.categoria,
                  _esp: usaFolhas(p.categoria)?String(((p.espessura||0)*1000)):'', _comp:String(p.comprimento??''), _larg:String(p.largura??''),
                  _folhas: usaFolhas(p.categoria)?String(p.folhas??''):'', _altura: usaFolhas(p.categoria)?'':String(p.altura??''),
                  numero:p.numero })} style={{fontSize:'15px'}}>✏️</button>
                <button onClick={()=>imprimirEtiqueta(p)} style={{fontSize:'15px'}}>🏷️</button>
                <button onClick={()=>del(p.id,p.numero)} style={{color:'var(--rd)',fontSize:'15px'}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {/* Modal de edição rápida de um pacote */}
      <Modal open={!!editPacote} onClose={()=>setEditPacote(null)} title={editPacote?`Corrigir pacote #${editPacote.numero} (${editPacote.categoria})`:''}
        footer={<><Btn onClick={()=>setEditPacote(null)}>Cancelar</Btn><Btn onClick={salvarEdicaoPacote} variant="primary">Salvar correção</Btn></>}>
        {editPacote && (usaFolhas(editPacote.categoria) ? (
          <>
            <div className="grid grid-cols-2 gap-x-3">
              <Input label="Espessura (mm)" value={editPacote._esp} onChange={(v:string)=>setEditPacote((e:any)=>({...e,_esp:v}))} type="text" inputMode="decimal" pattern="[0-9.,]*" />
              <Input label="Nº folhas" value={editPacote._folhas} onChange={(v:string)=>setEditPacote((e:any)=>({...e,_folhas:v}))} type="text" inputMode="numeric" pattern="[0-9]*" />
            </div>
            <div className="grid grid-cols-2 gap-x-3">
              <Input label="Comprimento" value={editPacote._comp} onChange={(v:string)=>setEditPacote((e:any)=>({...e,_comp:v}))} type="text" inputMode="decimal" pattern="[0-9.,]*" />
              <Input label="Largura" value={editPacote._larg} onChange={(v:string)=>setEditPacote((e:any)=>({...e,_larg:v}))} type="text" inputMode="decimal" pattern="[0-9.,]*" />
            </div>
          </>
        ) : (
          <>
            <Input label="Altura" value={editPacote._altura} onChange={(v:string)=>setEditPacote((e:any)=>({...e,_altura:v}))} type="text" inputMode="decimal" pattern="[0-9.,]*" />
            <div className="grid grid-cols-2 gap-x-3">
              <Input label="Comprimento" value={editPacote._comp} onChange={(v:string)=>setEditPacote((e:any)=>({...e,_comp:v}))} type="text" inputMode="decimal" pattern="[0-9.,]*" />
              <Input label="Largura" value={editPacote._larg} onChange={(v:string)=>setEditPacote((e:any)=>({...e,_larg:v}))} type="text" inputMode="decimal" pattern="[0-9.,]*" />
            </div>
          </>
        ))}
        {editPacote && (
          <div style={{fontSize:'13px',fontWeight:800,color:'var(--gn)',marginTop:'6px'}}>
            Novo m³: {m3fmt(volLinha(editPacote.categoria, { espessura:editPacote._esp, comprimento:editPacote._comp, largura:editPacote._larg, folhas:editPacote._folhas, altura:editPacote._altura }))}
          </div>
        )}
      </Modal>
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
                <input style={inG} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.espessura} onChange={e=>setLin(cat,i,'espessura',e.target.value)} placeholder="2,6" />
                <input style={inG} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.comprimento} onChange={e=>setLin(cat,i,'comprimento',e.target.value)} />
                <input style={inG} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.largura} onChange={e=>setLin(cat,i,'largura',e.target.value)} />
                <input style={inG} type="text" inputMode="numeric" pattern="[0-9]*" value={l.folhas} onChange={e=>setLin(cat,i,'folhas',e.target.value)} />
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
                <input style={inG} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.altura} onChange={e=>setLin(cat,i,'altura',e.target.value)} />
                <input style={inG} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.comprimento} onChange={e=>setLin(cat,i,'comprimento',e.target.value)} />
                <input style={inG} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.largura} onChange={e=>setLin(cat,i,'largura',e.target.value)} />
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
