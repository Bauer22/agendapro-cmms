'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Empty, useConfirm } from '@/components/ui'
import { td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

// ═══════════════════════════════════════════════════════════════
// PacotesProducao — lançamento da produção POR PACOTE (uso em tablet)
//
// - Cabeçalho do dia: madeira, m³ do tanque, sobra do tanque (producao_dia)
// - Cada pacote é lançado ao sair: capa/capinha (folhas) ou retalho/
//   aproveitamento (altura). Volume m³ calculado automaticamente.
// - Número de identificação sequencial por empresa (fn_proximo_numero_pacote).
// - Impressão da etiqueta do pacote para colar no material que vai ao estoque.
//
// Dimensões em METROS → volume direto em m³.
// ═══════════════════════════════════════════════════════════════

interface TipoLamina { id:string; nome:string; categoria:string; largura:number; comprimento:number; espessura:number|null }
interface Espessura { id:string; valor_m:number }

const usaFolhas = (cat:string) => cat === 'capa' || cat === 'capinha'
const money = (v:number) => `R$ ${(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const m3fmt = (v:number) => (v||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})

function calcVol(cat:string, larg:number, comp:number, esp:number, folhas:number, altura:number) {
  if (usaFolhas(cat)) return (folhas||0) * (larg||0) * (comp||0) * (esp||0)
  return (altura||0) * (larg||0) * (comp||0)
}

export default function PacotesProducao({ profile }: { profile: UserProfile|null }) {
  const [dia, setDia] = useState(td())
  const [cab, setCab] = useState<any>({ madeira:'', tanque_m3:'', sobra_m3:'' })
  const [tipos, setTipos] = useState<TipoLamina[]>([])
  const [espessuras, setEspessuras] = useState<Espessura[]>([])
  const [pacotes, setPacotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(false)
  const [novo, setNovo] = useState<any>({ categoria:'capa' })
  const { confirm, dialog } = useConfirm()

  useEffect(() => { loadMeta() }, [])
  useEffect(() => { loadDia() /* eslint-disable-next-line */ }, [dia])

  async function loadMeta() {
    const [t, e] = await Promise.all([
      supabase.from('tipos_lamina').select('*').eq('ativo',true).order('categoria').order('nome'),
      supabase.from('espessuras_lamina').select('*').eq('ativo',true).order('valor_m'),
    ])
    setTipos((t.data as TipoLamina[])||[])
    setEspessuras((e.data as Espessura[])||[])
  }

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
      company_id: profile?.company_id||null,
      dia,
      madeira: cab.madeira||null,
      tanque_m3: cab.tanque_m3 ? parseFloat(cab.tanque_m3) : 0,
      sobra_m3: cab.sobra_m3 ? parseFloat(cab.sobra_m3) : 0,
      created_by: profile?.display_name||'',
    }
    const { error } = await supabase.from('producao_dia').upsert(obj, { onConflict:'company_id,dia' })
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success('Cabeçalho do dia salvo ✅')
  }

  function abrirNovo(cat:string) {
    setNovo({ categoria:cat, tipoId:'', folhas:'', altura:'', larguraManual:'', comprimentoManual:'', espessuraManual:'' })
    setModal(true)
  }

  const tipo = tipos.find(t => t.id === novo.tipoId)
  // dimensões: se tem tipo selecionado usa dele; senão usa os campos manuais
  const dLarg = tipo ? +tipo.largura : parseFloat(novo.larguraManual)||0
  const dComp = tipo ? +tipo.comprimento : parseFloat(novo.comprimentoManual)||0
  const dEsp  = tipo ? +(tipo.espessura||0) : parseFloat(novo.espessuraManual)||0
  const previa = calcVol(novo.categoria, dLarg, dComp, dEsp, parseFloat(novo.folhas)||0, parseFloat(novo.altura)||0)

  async function salvarPacote(imprimir:boolean) {
    if (usaFolhas(novo.categoria)) {
      if (!(parseFloat(novo.folhas) > 0)) { toast.error('Informe o número de folhas'); return }
      if (!(dLarg>0 && dComp>0 && dEsp>0)) { toast.error('Selecione um tipo ou preencha largura, comprimento e espessura'); return }
    } else {
      if (!(parseFloat(novo.altura) > 0)) { toast.error('Informe a altura'); return }
      if (!(dLarg>0 && dComp>0)) { toast.error('Selecione um tipo ou preencha largura e comprimento'); return }
    }
    setSaving(true)
    // número sequencial
    const { data: num, error: eNum } = await supabase.rpc('fn_proximo_numero_pacote', { p_company_id: profile?.company_id||null })
    if (eNum) { toast.error('Erro ao gerar número: '+eNum.message); setSaving(false); return }
    const vol = previa
    const obj:any = {
      company_id: profile?.company_id||null,
      dia,
      numero: num,
      categoria: novo.categoria,
      tipo_lamina_id: tipo?.id||null,
      tipo_nome: tipo?.nome||null,
      espessura: usaFolhas(novo.categoria) ? dEsp : null,
      largura: dLarg,
      comprimento: dComp,
      altura: usaFolhas(novo.categoria) ? null : (parseFloat(novo.altura)||0),
      folhas: usaFolhas(novo.categoria) ? (parseFloat(novo.folhas)||0) : null,
      volume_m3: vol,
      created_by: profile?.display_name||'',
    }
    const { data, error } = await supabase.from('producao_pacotes').insert(obj).select().single()
    if (error) { toast.error('Erro: '+error.message); setSaving(false); return }
    toast.success(`Pacote #${num} lançado ✅`)
    setSaving(false); setModal(false)
    await loadDia()
    if (imprimir && data) imprimirEtiqueta(data)
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
      ? `${p.folhas} folhas · ${p.largura}×${p.comprimento}×${(p.espessura*1000).toLocaleString('pt-BR')}mm`
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
          <div style="font-size:13px;text-align:center;text-transform:uppercase">${esc(p.categoria)}${p.tipo_nome?` · ${esc(p.tipo_nome)}`:''}</div>
          <div style="font-size:11px;text-align:center;color:#333;margin-top:2px">${esc(dim)}</div>
          <div style="font-size:16px;font-weight:bold;text-align:center;margin-top:4px">${m3fmt(p.volume_m3)} m³</div>
        </div>
      </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),300) }
  }

  const totalM3 = pacotes.reduce((s,p)=>s+(+p.volume_m3||0),0)
  const tanqueLiq = (parseFloat(cab.tanque_m3)||0) - (parseFloat(cab.sobra_m3)||0)

  const btn = (cat:string, label:string, cor:string) => (
    <button onClick={()=>abrirNovo(cat)}
      style={{flex:1,minWidth:'120px',padding:'18px 10px',borderRadius:'14px',border:`2px solid ${cor}`,
        background:'var(--s1)',color:cor,fontWeight:800,fontSize:'15px',cursor:'pointer'}}>
      ➕ {label}
    </button>
  )

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
        <div style={{fontSize:'11px',color:'var(--cy)',fontWeight:700,marginBottom:'8px'}}>
          Tanque laminado: {m3fmt(tanqueLiq)} m³
        </div>
        <Btn onClick={salvarCabecalho} variant="primary" size="sm">💾 Salvar dados do dia</Btn>
      </div>

      {/* Botões de lançamento por pacote */}
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'12px'}}>
        {btn('capa','Capa','#22c55e')}
        {btn('capinha','Capinha','#3b82f6')}
        {btn('retalho','Retalho','#f59e0b')}
        {btn('aproveitamento','Aproveit.','#a855f7')}
      </div>

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
                  {p.tipo_nome ? p.tipo_nome+' · ' : ''}
                  {usaFolhas(p.categoria) ? `${p.folhas} folhas` : `alt ${p.altura}`} · <b style={{color:'var(--gn)'}}>{m3fmt(p.volume_m3)} m³</b>
                </div>
              </div>
              <div className="flex gap-1">
                <Btn onClick={()=>imprimirEtiqueta(p)} size="sm">🏷️</Btn>
                <Btn onClick={()=>del(p.id,p.numero)} variant="danger" size="sm">🗑</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de lançamento do pacote */}
      <Modal open={modal} onClose={()=>setModal(false)}
        title={`Lançar pacote — ${novo.categoria||''}`}
        footer={<>
          <Btn onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={()=>salvarPacote(false)} size="md" disabled={saving}>Salvar</Btn>
          <Btn onClick={()=>salvarPacote(true)} variant="primary" size="md" disabled={saving}>{saving?'...':'Salvar + Etiqueta'}</Btn>
        </>}>

        <Select label="Tipo cadastrado (opcional)" value={novo.tipoId||''}
          onChange={(v:string)=>setNovo((e:any)=>({...e,tipoId:v}))}
          options={[
            {value:'',label:'— sem tipo / dimensões manuais —'},
            ...tipos.filter(t=>t.categoria===novo.categoria).map(t=>({value:t.id,label:`${t.nome}${t.espessura?` · ${(t.espessura*1000).toLocaleString('pt-BR')}mm`:''}`})),
          ]} />

        {!tipo && (
          <>
            <div className="grid grid-cols-2 gap-x-3">
              <Input label="Largura (m)" value={novo.larguraManual} onChange={(v:string)=>setNovo((e:any)=>({...e,larguraManual:v}))} type="number" placeholder="Ex: 1.30" />
              <Input label="Comprimento (m)" value={novo.comprimentoManual} onChange={(v:string)=>setNovo((e:any)=>({...e,comprimentoManual:v}))} type="number" placeholder="Ex: 2.60" />
            </div>
            {usaFolhas(novo.categoria) && (
              <Select label="Espessura" value={novo.espessuraManual||''}
                onChange={(v:string)=>setNovo((e:any)=>({...e,espessuraManual:v}))}
                options={[{value:'',label:'Selecione...'}, ...espessuras.map(e=>({value:String(e.valor_m),label:`${(e.valor_m*1000).toLocaleString('pt-BR')} mm`}))]} />
            )}
          </>
        )}

        {usaFolhas(novo.categoria)
          ? <Input label="Número de folhas *" value={novo.folhas} onChange={(v:string)=>setNovo((e:any)=>({...e,folhas:v}))} type="number" placeholder="Ex: 500" />
          : <Input label="Altura (m) *" value={novo.altura} onChange={(v:string)=>setNovo((e:any)=>({...e,altura:v}))} type="number" placeholder="Ex: 1.20" />}

        {previa > 0 && (
          <div style={{fontSize:'14px',fontWeight:800,color:'var(--gn)',marginTop:'4px'}}>
            📦 Volume: {m3fmt(previa)} m³
          </div>
        )}
      </Modal>
    </div>
  )
}
