'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Input, SelectComCadastro, SH, KPI, Empty, useConfirm } from '@/components/ui'
import { td } from '@/lib/utils'
import toast from 'react-hot-toast'

type Props = { profile?: any; can?: any }

const n3 = (v:number)=> (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})
// aceita vírgula OU ponto (operador digita 2,6 no tablet)
const num = (v:any)=> parseFloat(String(v==null?'':v).replace(',', '.')) || 0

// Os 4 tipos (iguais à Produção). capa/capinha usam folhas; retalho/aprov. usam altura.
const TIPOS = [
  { cat:'capa',           label:'CAPA',           cor:'#2f9e5a' },
  { cat:'capinha',        label:'CAPINHA',        cor:'#3b82f6' },
  { cat:'retalho',        label:'RETALHO',        cor:'#e8a21c' },
  { cat:'aproveitamento', label:'APROVEITAMENTO', cor:'#8b5cf6' },
]
const usaFolhas = (cat:string)=> cat==='capa' || cat==='capinha'

// volume de uma linha (espessura em MM → /1000)
function volLinha(cat:string, l:any){
  const larg = num(l.largura), comp = num(l.comprimento)
  if (usaFolhas(cat)) return num(l.folhas) * comp * larg * (num(l.espessura)/1000)
  return num(l.altura) * comp * larg
}

export default function RomaneioLamina({ profile }: Props) {
  const { confirm, dialog } = useConfirm()
  const cid = profile?.company_id || null
  const [aba, setAba] = useState<'novo'|'historico'>('novo')
  const [maximizado, setMaximizado] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])

  // cabeçalho
  const [cab, setCab] = useState<any>({ data: td(), motorista:'', cliente_id:'', placa:'', chapa_qtd:'', chapa_medida:'' })
  // grades por categoria (cada linha: espessura, comprimento, largura, folhas, altura)
  const [grades, setGrades] = useState<Record<string,any[]>>({ capa:[], capinha:[], retalho:[], aproveitamento:[] })
  const [editId, setEditId] = useState<string>('')      // id do romaneio em edição
  const [editNumero, setEditNumero] = useState<number|null>(null)
  const [editSaleId, setEditSaleId] = useState<string>('')

  async function loadClientes() {
    const { data } = await supabase.from('cadastros').select('id,nome_razao').eq('is_cliente',true).eq('status',true).order('nome_razao')
    setClientes(data||[])
  }
  async function loadHistorico() {
    const { data } = await supabase.from('romaneios_lamina').select('*').order('data',{ascending:false}).order('created_at',{ascending:false}).limit(100)
    setHistorico(data||[])
  }
  useEffect(()=>{ loadClientes() },[])
  useEffect(()=>{ if(aba==='historico') loadHistorico() },[aba])

  // totais ao vivo por categoria + carga total
  const totalCat = (cat:string)=> (grades[cat]||[]).reduce((s,l)=> s + volLinha(cat,l), 0)
  const totalLamina = totalCat('capa') + totalCat('capinha')   // "lâmina" = capa + capinha
  const totalRetalho = totalCat('retalho') + totalCat('aproveitamento')
  const cargaTotal = totalLamina + totalRetalho

  // edição de grade
  const linhaVazia = ()=>({ espessura:'', comprimento:'', largura:'', folhas:'', altura:'' })
  const setLin = (cat:string, i:number, campo:string, v:string)=>
    setGrades(g=>({...g, [cat]: (g[cat]||[]).map((l,idx)=> idx===i?{...l,[campo]:v}:l)}))
  // + Lançamento: herda comp/larg/esp da última (folhas/altura vazios)
  const addLinha = (cat:string)=> setGrades(g=>{
    const arr = g[cat]||[]; const u = arr[arr.length-1] || {}
    return {...g, [cat]: [...arr, { espessura: u.espessura||'', comprimento: u.comprimento||'', largura: u.largura||'', folhas:'', altura:'' }]}
  })
  const delLinha = (cat:string, i:number)=> setGrades(g=>({...g, [cat]: (g[cat]||[]).filter((_,idx)=>idx!==i)}))

  function limpar() {
    setCab({ data: td(), motorista:'', cliente_id:'', placa:'', chapa_qtd:'', chapa_medida:'' })
    setGrades({ capa:[], capinha:[], retalho:[], aproveitamento:[] })
    setEditId(''); setEditNumero(null); setEditSaleId('')
  }

  // carrega um romaneio salvo de volta para o formulário (edição)
  async function editarRomaneio(rom:any) {
    const { data: itens } = await supabase.from('romaneios_lamina_itens').select('*').eq('romaneio_id', rom.id).order('ordem')
    const g:Record<string,any[]> = { capa:[], capinha:[], retalho:[], aproveitamento:[] }
    ;(itens||[]).forEach((i:any)=>{
      const cat = g[i.tipo] ? i.tipo : (i.tipo==='lamina' ? 'capa' : 'retalho')  // compat itens antigos
      if (!g[cat]) g[cat]=[]
      g[cat].push({
        espessura: usaFolhas(cat) ? String((i.espessura_mm ?? '')) : '',
        comprimento: String(i.comprimento ?? ''), largura: String(i.largura ?? ''),
        folhas: usaFolhas(cat) ? String(i.n_folhas ?? '') : '',
        altura: usaFolhas(cat) ? '' : String(i.altura ?? ''),
      })
    })
    setGrades(g)
    setCab({ data: rom.data, motorista: rom.motorista||'', cliente_id: rom.cliente_id||'', placa: rom.placa||'', chapa_qtd: rom.chapa_qtd??'', chapa_medida: rom.chapa_medida||'' })
    setEditId(rom.id); setEditNumero(rom.numero); setEditSaleId(rom.sale_order_id||'')
    setAba('novo')
    toast.success(`Editando romaneio #${rom.numero}`)
  }

  // monta a lista de itens válidos de todas as categorias, para gravar/PDF
  function itensValidos() {
    const out: any[] = []
    TIPOS.forEach(t=>{
      (grades[t.cat]||[]).forEach(l=>{
        const vol = volLinha(t.cat, l)
        if (vol>0) out.push({ cat:t.cat, label:t.label, l, vol })
      })
    })
    return out
  }

  async function gerarRomaneio() {
    if (saving) return
    const cli = clientes.find(c=>c.id===cab.cliente_id)
    if (!cli) { toast.error('Selecione o cliente'); return }
    const itens = itensValidos()
    if (itens.length===0) { toast.error('Informe ao menos uma linha preenchida'); return }
    setSaving(true)
    try {
      let numero = editNumero
      let romId = editId

      if (editId) {
        const { error: eU } = await supabase.from('romaneios_lamina').update({
          data: cab.data, motorista: cab.motorista||null, cliente_id: cab.cliente_id, cliente_nome: cli.nome_razao,
          placa: (cab.placa||'').toUpperCase()||null, chapa_qtd: cab.chapa_qtd? Number(cab.chapa_qtd):null, chapa_medida: cab.chapa_medida||null,
          total_lamina: totalLamina, total_retalho: totalRetalho, carga_total: cargaTotal,
        }).eq('id', editId)
        if (eU) throw eU
        await supabase.from('romaneios_lamina_itens').delete().eq('romaneio_id', editId)
      } else {
        const { data: ult } = await supabase.from('romaneios_lamina').select('numero').order('numero',{ascending:false}).limit(1).maybeSingle()
        numero = ((ult?.numero)||0) + 1
        const { data: rom, error: e1 } = await supabase.from('romaneios_lamina').insert({
          company_id: cid, numero, data: cab.data, motorista: cab.motorista||null,
          cliente_id: cab.cliente_id, cliente_nome: cli.nome_razao, placa: (cab.placa||'').toUpperCase()||null,
          chapa_qtd: cab.chapa_qtd? Number(cab.chapa_qtd):null, chapa_medida: cab.chapa_medida||null,
          total_lamina: totalLamina, total_retalho: totalRetalho, carga_total: cargaTotal,
          created_by: profile?.display_name||'',
        }).select().single()
        if (e1) throw e1
        romId = rom.id
      }

      // grava os itens — tipo guarda a categoria (capa/capinha/retalho/aproveitamento)
      const rows = itens.map((it,i)=>({
        company_id:cid, romaneio_id:romId, tipo:it.cat, ordem:i,
        espessura_mm: usaFolhas(it.cat) ? num(it.l.espessura) : 0,
        comprimento: num(it.l.comprimento), largura: num(it.l.largura),
        n_folhas: usaFolhas(it.cat) ? num(it.l.folhas) : 0,
        altura: usaFolhas(it.cat) ? 0 : num(it.l.altura),
        metragem: it.vol,
      }))
      if (rows.length>0) await supabase.from('romaneios_lamina_itens').insert(rows)

      // venda: uma só, total somado
      if (editId && editSaleId) {
        await supabase.from('sales_orders').update({
          sale_date: cab.data, client_id: cab.cliente_id, client_name: cli.nome_razao,
          volume_m3: cargaTotal, plate: (cab.placa||'').toUpperCase()||'—', driver: cab.motorista||'—',
          notes: `Romaneio lâmina #${numero} · lâmina ${n3(totalLamina)} + retalho ${n3(totalRetalho)} m³`,
          updated_by: profile?.display_name,
        }).eq('id', editSaleId)
      } else if (!editId) {
        const { data: venda } = await supabase.from('sales_orders').insert({
          sale_date: cab.data, client_id: cab.cliente_id, client_name: cli.nome_razao,
          product_name: 'LÂMINA', volume_m3: cargaTotal, plate: (cab.placa||'').toUpperCase()||'—',
          driver: cab.motorista||'—', status:'active', romaneio_num: numero,
          notes: `Romaneio lâmina #${numero} · lâmina ${n3(totalLamina)} + retalho ${n3(totalRetalho)} m³`,
          created_by: profile?.display_name||'', created_by_id: profile?.id||null, company_id: cid,
        }).select().single()
        if (venda?.id) await supabase.from('romaneios_lamina').update({ sale_order_id: venda.id }).eq('id', romId)
      }

      toast.success(editId ? `Romaneio #${numero} atualizado ✅` : `Romaneio #${numero} gerado e lançado em vendas ✅`)
      await gerarPDF({ id:romId, numero, data:cab.data, motorista:cab.motorista, placa:(cab.placa||'').toUpperCase(), chapa_qtd:cab.chapa_qtd, chapa_medida:cab.chapa_medida, carga_total:cargaTotal }, itens, cli.nome_razao)
      limpar(); setMaximizado(false); setAba('historico')
    } catch(e:any){ toast.error('Erro: '+e.message) }
    finally { setSaving(false) }
  }

  // PDF: 2 colunas, um grupo por tipo (como a Produção diária)
  async function gerarPDF(rom:any, itens:any[], clienteNome:string) {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const { addLogoOnBand } = await import('@/lib/pdf')
      const doc = new jsPDF()
      const pageW = doc.internal.pageSize.getWidth()

      doc.setFillColor(6,13,26); doc.rect(0,0,pageW,22,'F')
      await addLogoOnBand(doc, 22)
      doc.setTextColor(249,115,22); doc.setFontSize(13); doc.setFont('helvetica','bold')
      doc.text('SAÍDA — ROMANEIO DE LÂMINA', 12, 10)
      doc.setTextColor(226,232,240); doc.setFontSize(8); doc.setFont('helvetica','normal')
      doc.text(`Nº ${rom.numero}   Data: ${String(rom.data).split('-').reverse().join('/')}   Cliente: ${clienteNome}   Motorista: ${rom.motorista||'—'}   Placa: ${rom.placa||'—'}`, 12, 17)

      const marginL = 8, gap = 4
      const colW = (pageW - marginL*2 - gap) / 2
      const startY = 26, fs = 6.5

      // agrupa por categoria
      const porCat: Record<string,any[]> = { capa:[], capinha:[], retalho:[], aproveitamento:[] }
      itens.forEach(it=>{ (porCat[it.cat] = porCat[it.cat]||[]).push(it) })

      const drawGrupo = (cat:string, label:string, x:number, y:number):number => {
        const arr = porCat[cat]||[]
        if (arr.length===0) return y
        const folhas = usaFolhas(cat)
        const tot = arr.reduce((s,it)=>s+it.vol,0)
        const head = folhas ? [['#','Esp','Comp','Larg','Folhas','m³']] : [['#','Alt','Comp','Larg','m³']]
        const body = arr.map((it,i)=> folhas
          ? [String(i+1), String(it.l.espessura), String(it.l.comprimento), String(it.l.largura), String(it.l.folhas), n3(it.vol)]
          : [String(i+1), String(it.l.altura), String(it.l.comprimento), String(it.l.largura), n3(it.vol)])
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
        doc.text(label, x, y)
        autoTable(doc, {
          startY: y+2, margin:{left:x}, tableWidth: colW,
          head, body,
          foot: [folhas ? ['','','','','TOTAL', n3(tot)] : ['','','','TOTAL', n3(tot)]],
          theme:'grid',
          headStyles:{fillColor:[249,115,22],fontSize:fs,halign:'center',cellPadding:1},
          bodyStyles:{fontSize:fs,cellPadding:0.8,textColor:[20,20,20]},
          footStyles:{fillColor:[30,58,95],textColor:[255,255,255],fontSize:fs,halign:'right',cellPadding:1},
          styles:{lineColor:[160,160,160],lineWidth:0.1},
        })
        return (doc as any).lastAutoTable.finalY + 6
      }

      // esquerda: CAPA + RETALHO | direita: CAPINHA + APROVEITAMENTO
      const xL = marginL, xR = marginL + colW + gap
      let yL = startY, yR = startY
      yL = drawGrupo('capa', 'CAPA', xL, yL)
      yL = drawGrupo('retalho', 'RETALHO', xL, yL)
      yR = drawGrupo('capinha', 'CAPINHA', xR, yR)
      yR = drawGrupo('aproveitamento', 'APROVEITAMENTO', xR, yR)

      let y = Math.max(yL, yR) + 8
      const pageH = doc.internal.pageSize.getHeight()
      if (y > pageH - 30) y = pageH - 30
      doc.setFillColor(249,115,22); doc.rect(marginL, y, pageW-marginL*2, 11, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont('helvetica','bold')
      doc.text('CARGA TOTAL', marginL+4, y+7.5)
      doc.text(n3(rom.carga_total)+' m³', pageW-marginL-4, y+7.5, {align:'right'})
      y += 17
      doc.setTextColor(0,0,0); doc.setFontSize(9); doc.setFont('helvetica','bold')
      doc.text(`CHAPA: ${rom.chapa_qtd||'—'}        CHAPINHA: ${rom.chapa_medida||'—'}`, marginL, y); y += 9
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60)
      doc.text('Assinatura: ____________________________          Recebido por: ____________________________', marginL, y)

      doc.save(`romaneio_lamina_${rom.numero}.pdf`)
    } catch(e:any){ toast.error('Erro ao gerar PDF: '+e.message) }
  }

  async function reimprimir(rom:any) {
    const { data: itens } = await supabase.from('romaneios_lamina_itens').select('*').eq('romaneio_id', rom.id).order('ordem')
    const list = (itens||[]).map((i:any)=>{
      const cat = TIPOS.find(t=>t.cat===i.tipo) ? i.tipo : (i.tipo==='lamina'?'capa':'retalho')
      return { cat, label:(TIPOS.find(t=>t.cat===cat)?.label||cat).toUpperCase(),
        l:{ espessura:i.espessura_mm, comprimento:i.comprimento, largura:i.largura, folhas:i.n_folhas, altura:i.altura },
        vol: Number(i.metragem)||0 }
    })
    await gerarPDF(rom, list, rom.cliente_nome)
  }

  async function excluirRomaneio(rom:any) {
    if (!await confirm(`Excluir o romaneio #${rom.numero}? A venda lançada também será removida. Esta ação não pode ser desfeita.`)) return
    if (rom.sale_order_id) await supabase.from('sales_orders').delete().eq('id', rom.sale_order_id)
    await supabase.from('romaneios_lamina_itens').delete().eq('romaneio_id', rom.id)
    const { error } = await supabase.from('romaneios_lamina').delete().eq('id', rom.id)
    if (error) { toast.error('Erro ao excluir: '+error.message); return }
    toast.success(`Romaneio #${rom.numero} excluído`)
    loadHistorico()
  }

  return (
    <div style={ maximizado
      ? { position:'fixed', inset:0, zIndex:9999, background:'var(--bg)', overflowY:'auto', padding:'0', paddingTop:'var(--sat)', WebkitOverflowScrolling:'touch' }
      : { padding:'14px' } }>

      {/* Barra fixa do modo maximizado */}
      {maximizado && (
        <div style={{position:'sticky',top:0,zIndex:2,background:'var(--s1)',borderBottom:'1px solid var(--bd)',
          boxShadow:'0 2px 10px -4px rgba(0,0,0,.2)',padding:'10px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
          <div style={{fontSize:'13px',fontWeight:800,color:'var(--t1)'}}>🪵 Romaneio de Lâmina</div>
          <Btn onClick={()=>setMaximizado(false)} size="md" variant="danger">✕ Sair da tela cheia</Btn>
        </div>
      )}

      {!maximizado && (
      <SH label="🪵 ROMANEIO DE SAÍDA — LÂMINA" action={
        <div className="flex gap-1.5">
          {aba==='novo' && (
            <Btn onClick={()=>setMaximizado(true)} size="sm" variant="secondary">⛶ Maximizar</Btn>
          )}
          {[{k:'novo',l:'➕ Novo'},{k:'historico',l:'📚 Histórico'}].map(t=>(
            <Btn key={t.k} onClick={()=>{setAba(t.k as any); if(t.k==='historico') setMaximizado(false)}} size="sm" variant={aba===t.k?'primary':'secondary'}>{t.l}</Btn>
          ))}
        </div>
      } />
      )}

      {aba==='novo' && (
        <div style={ maximizado ? { padding:'12px' } : undefined }>
          {editId && (
            <div className="rounded-xl p-2 mb-2 flex justify-between items-center" style={{background:'rgba(47,168,154,.12)',border:'1px solid rgba(47,168,154,.4)'}}>
              <span style={{fontSize:'11px',color:'var(--cy)'}}>✏️ Editando romaneio <b>#{editNumero}</b></span>
              <button onClick={limpar} style={{fontSize:'10px',color:'var(--t3)'}}>✕ cancelar edição (novo)</button>
            </div>
          )}

          {/* Cabeçalho completo (fora do maximizado) */}
          {!maximizado && <>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Input label="Data" type="date" value={cab.data} onChange={(v:string)=>setCab({...cab,data:v})} />
            <Input label="Motorista" value={cab.motorista} onChange={(v:string)=>setCab({...cab,motorista:v})} />
          </div>
          <SelectComCadastro label="Cliente *" tipo="cliente" value={cab.cliente_id}
            onChange={(v:string)=>setCab({...cab,cliente_id:v})}
            options={clientes.map(c=>({value:c.id,label:c.nome_razao}))}
            companyId={cid} createdBy={profile?.display_name} onCreatedRefresh={loadClientes} />
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Input label="Placa" value={cab.placa} onChange={(v:string)=>setCab({...cab,placa:v})} />
            <Input label="Chapa (qtd)" type="text" inputMode="numeric" pattern="[0-9]*" value={cab.chapa_qtd} onChange={(v:string)=>setCab({...cab,chapa_qtd:v})} />
            <Input label="Chapinha" value={cab.chapa_medida} onChange={(v:string)=>setCab({...cab,chapa_medida:v})} placeholder="Ex: 1,30" />
          </div>
          </>}

          {/* Cabeçalho compacto (no maximizado) */}
          {maximizado && (
            <div className="mb-2">
              <SelectComCadastro label="Cliente *" tipo="cliente" value={cab.cliente_id}
                onChange={(v:string)=>setCab({...cab,cliente_id:v})}
                options={clientes.map(c=>({value:c.id,label:c.nome_razao}))}
                companyId={cid} createdBy={profile?.display_name} onCreatedRefresh={loadClientes} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Placa" value={cab.placa} onChange={(v:string)=>setCab({...cab,placa:v})} />
                <Input label="Motorista" value={cab.motorista} onChange={(v:string)=>setCab({...cab,motorista:v})} />
              </div>
            </div>
          )}

          {/* Seções por tipo de lâmina (modelo Produção) */}
          {TIPOS.map(t=> (
            <Secao key={t.cat} cat={t.cat} label={t.label} cor={t.cor}
              arr={grades[t.cat]||[]} setLin={setLin} addLinha={addLinha} delLinha={delLinha} />
          ))}

          {/* Totais */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <KPI num={n3(totalLamina)} label="Lâmina m³" color="blue" />
            <KPI num={n3(totalRetalho)} label="Retalho m³" color="amber" />
            <KPI num={n3(cargaTotal)} label="Carga total m³" color="green" />
          </div>

          <div className="flex gap-2">
            <Btn onClick={gerarRomaneio} variant="primary" disabled={saving}>{saving?'Salvando...':(editId?`💾 Salvar alterações (#${editNumero})`:'🪵 Gerar romaneio + lançar venda')}</Btn>
            <Btn onClick={limpar} variant="secondary">Limpar</Btn>
          </div>
        </div>
      )}

      {aba==='historico' && (
        historico.length===0 ? <Empty icon="📚" text="Nenhum romaneio gerado" />
        : <div className="flex flex-col gap-2">
            {historico.map(r=>(
              <div key={r.id} className="p-3 rounded-xl flex justify-between items-center gap-3 flex-wrap" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div>
                  <b style={{color:'var(--t1)',fontSize:'13px'}}>Romaneio #{r.numero}</b> <span style={{color:'var(--t3)',fontSize:'11px'}}>{String(r.data).split('-').reverse().join('/')}</span>
                  <div style={{color:'var(--t2)',fontSize:'11px'}}>{r.cliente_nome} · {r.motorista||'—'} · {r.placa||'—'}</div>
                </div>
                <div style={{textAlign:'right',fontSize:'11px',color:'var(--t2)'}}>
                  <div>Lâmina {n3(r.total_lamina)} · Retalho {n3(r.total_retalho)}</div>
                  <div><b style={{color:'var(--gn)'}}>Total {n3(r.carga_total)} m³</b></div>
                </div>
                <div className="flex gap-1.5">
                  <Btn onClick={()=>editarRomaneio(r)} size="sm" variant="secondary">✏️ Editar</Btn>
                  <Btn onClick={()=>reimprimir(r)} size="sm" variant="secondary">🖨️ Reimprimir</Btn>
                  <Btn onClick={()=>excluirRomaneio(r)} size="sm" variant="danger">🗑️</Btn>
                </div>
              </div>
            ))}
          </div>
      )}
      {dialog}
    </div>
  )
}

// ── Seção de grade de uma categoria (componente de TOPO p/ não perder foco) ──
function Secao({ cat, label, cor, arr, setLin, addLinha, delLinha }:{
  cat:string; label:string; cor:string; arr:any[];
  setLin:(cat:string,i:number,campo:string,v:string)=>void;
  addLinha:(cat:string)=>void; delLinha:(cat:string,i:number)=>void;
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
                <div style={{...cel,textAlign:'right',color:'var(--gn)',fontWeight:700}}>{n3(volLinha(cat,l))}</div>
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
                <div style={{...cel,textAlign:'right',color:'var(--gn)',fontWeight:700}}>{n3(volLinha(cat,l))}</div>
                <button onClick={()=>delLinha(cat,i)} style={{color:'var(--rd)',fontSize:'13px'}}>✕</button>
              </div>
            ))}
          </div>
        )
      )}

      <div className="flex items-center gap-2 flex-wrap mt-1">
        <Btn onClick={()=>addLinha(cat)} size="sm" style={{background:cor,color:'#fff',border:'none'}}>+ Lançamento</Btn>
        {arr.length>0 && <span style={{fontSize:'12px',fontWeight:800,color:'var(--gn)'}}>Total: {n3(total)} m³</span>}
      </div>
    </div>
  )
}

const hdr: React.CSSProperties = { fontSize:'8px', color:'var(--t3)', textTransform:'uppercase', fontWeight:700, padding:'2px' }
const cel: React.CSSProperties = { fontSize:'11px', color:'var(--t2)', display:'flex', alignItems:'center', justifyContent:'center' }
const inG: React.CSSProperties = { width:'100%', background:'var(--s2)', border:'1px solid var(--bd)', borderRadius:'6px', padding:'5px 6px', color:'var(--t1)', fontSize:'11px', outline:'none' }
