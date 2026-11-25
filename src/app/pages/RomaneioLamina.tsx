'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Input, Select, SelectComCadastro, SH, KPI, Empty, useConfirm } from '@/components/ui'
import { td } from '@/lib/utils'
import toast from 'react-hot-toast'

type Props = { profile?: any; can?: any }

const n3 = (v:number)=> (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})
// aceita vírgula OU ponto (operador digita 2,6 no tablet)
const num = (v:any)=> parseFloat(String(v==null?'':v).replace(',', '.')) || 0

// linha de lâmina: espessura(mm) · comprimento · largura · nº folhas → metragem(m³)
const calcLamina = (l:any)=> num(l.n_folhas) * num(l.comprimento) * num(l.largura) * (num(l.espessura_mm)/1000)
// linha de retalho: altura · comprimento · largura → metros(m³)
const calcRetalho = (r:any)=> num(r.altura) * num(r.comprimento) * num(r.largura)

const linhaLaminaVazia = ()=>({ espessura_mm:'', comprimento:'', largura:'', n_folhas:'' })
const linhaRetalhoVazia = ()=>({ altura:'', comprimento:'', largura:'' })

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
  // grades
  const [laminas, setLaminas] = useState<any[]>([linhaLaminaVazia()])
  const [retalhos, setRetalhos] = useState<any[]>([linhaRetalhoVazia()])
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

  // totais ao vivo
  const totalLamina = laminas.reduce((s,l)=> s + calcLamina(l), 0)
  const totalRetalho = retalhos.reduce((s,r)=> s + calcRetalho(r), 0)
  const cargaTotal = totalLamina + totalRetalho

  // edição de grade
  const setLam = (i:number, campo:string, v:string)=> setLaminas(p=>p.map((l,idx)=> idx===i?{...l,[campo]:v}:l))
  const setRet = (i:number, campo:string, v:string)=> setRetalhos(p=>p.map((r,idx)=> idx===i?{...r,[campo]:v}:r))
  // + Linha herda espessura/comprimento/largura da última (folhas fica vazio)
  const addLam = ()=> setLaminas(p=>{
    const u = p[p.length-1] || {}
    return [...p, { espessura_mm: u.espessura_mm||'', comprimento: u.comprimento||'', largura: u.largura||'', n_folhas:'' }]
  })
  // retalho herda comprimento/largura da última (altura fica vazia)
  const addRet = ()=> setRetalhos(p=>{
    const u = p[p.length-1] || {}
    return [...p, { altura:'', comprimento: u.comprimento||'', largura: u.largura||'' }]
  })
  const delLam = (i:number)=> setLaminas(p=>p.length>1?p.filter((_,idx)=>idx!==i):p)
  const delRet = (i:number)=> setRetalhos(p=>p.length>1?p.filter((_,idx)=>idx!==i):p)

  function limpar() {
    setCab({ data: td(), motorista:'', cliente_id:'', placa:'', chapa_qtd:'', chapa_medida:'' })
    setLaminas([linhaLaminaVazia()]); setRetalhos([linhaRetalhoVazia()])
    setEditId(''); setEditNumero(null); setEditSaleId('')
  }

  // carrega um romaneio salvo de volta para o formulário (edição)
  async function editarRomaneio(rom:any) {
    const { data: itens } = await supabase.from('romaneios_lamina_itens').select('*').eq('romaneio_id', rom.id).order('ordem')
    const lams = (itens||[]).filter((i:any)=>i.tipo==='lamina').map((i:any)=>({ espessura_mm:String(i.espessura_mm??''), comprimento:String(i.comprimento??''), largura:String(i.largura??''), n_folhas:String(i.n_folhas??'') }))
    const rets = (itens||[]).filter((i:any)=>i.tipo==='retalho').map((i:any)=>({ altura:String(i.altura??''), comprimento:String(i.comprimento??''), largura:String(i.largura??'') }))
    setCab({ data: rom.data, motorista: rom.motorista||'', cliente_id: rom.cliente_id||'', placa: rom.placa||'', chapa_qtd: rom.chapa_qtd??'', chapa_medida: rom.chapa_medida||'' })
    setLaminas(lams.length?lams:[linhaLaminaVazia()])
    setRetalhos(rets.length?rets:[linhaRetalhoVazia()])
    setEditId(rom.id); setEditNumero(rom.numero); setEditSaleId(rom.sale_order_id||'')
    setAba('novo')
    toast.success(`Editando romaneio #${rom.numero}`)
  }

  async function gerarRomaneio() {
    if (saving) return
    const cli = clientes.find(c=>c.id===cab.cliente_id)
    if (!cli) { toast.error('Selecione o cliente'); return }
    const lamsValidas = laminas.filter(l=>calcLamina(l)>0)
    const retsValidos = retalhos.filter(r=>calcRetalho(r)>0)
    if (lamsValidas.length===0 && retsValidos.length===0) { toast.error('Informe ao menos uma lâmina ou retalho'); return }
    setSaving(true)
    try {
      let numero = editNumero
      let romId = editId

      if (editId) {
        // ── EDIÇÃO: atualiza cabeçalho, apaga itens antigos e regrava ──
        const { error: eU } = await supabase.from('romaneios_lamina').update({
          data: cab.data, motorista: cab.motorista||null, cliente_id: cab.cliente_id, cliente_nome: cli.nome_razao,
          placa: (cab.placa||'').toUpperCase()||null, chapa_qtd: cab.chapa_qtd? Number(cab.chapa_qtd):null, chapa_medida: cab.chapa_medida||null,
          total_lamina: totalLamina, total_retalho: totalRetalho, carga_total: cargaTotal,
        }).eq('id', editId)
        if (eU) throw eU
        await supabase.from('romaneios_lamina_itens').delete().eq('romaneio_id', editId)
      } else {
        // ── NOVO: sequencial + cabeçalho ──
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

      // grava os itens
      const itens = [
        ...lamsValidas.map((l,i)=>({ company_id:cid, romaneio_id:romId, tipo:'lamina', ordem:i,
          espessura_mm:num(l.espessura_mm), comprimento:num(l.comprimento), largura:num(l.largura),
          n_folhas:num(l.n_folhas), metragem:calcLamina(l) })),
        ...retsValidos.map((r,i)=>({ company_id:cid, romaneio_id:romId, tipo:'retalho', ordem:i,
          altura:num(r.altura), comprimento:num(r.comprimento), largura:num(r.largura),
          metragem:calcRetalho(r) })),
      ]
      if (itens.length>0) await supabase.from('romaneios_lamina_itens').insert(itens)

      // venda: atualiza a existente (edição) ou cria nova
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
      await gerarPDF({ id:romId, numero, data:cab.data, motorista:cab.motorista, placa:(cab.placa||'').toUpperCase(), chapa_qtd:cab.chapa_qtd, chapa_medida:cab.chapa_medida, carga_total:cargaTotal, total_lamina:totalLamina, total_retalho:totalRetalho }, lamsValidas, retsValidos, cli.nome_razao)
      limpar(); setMaximizado(false); setAba('historico')
    } catch(e:any){ toast.error('Erro: '+e.message) }
    finally { setSaving(false) }
  }

  async function gerarPDF(rom:any, lams:any[], rets:any[], clienteNome:string) {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const { addLogoOnBand } = await import('@/lib/pdf')
      const doc = new jsPDF()  // retrato, 1 folha
      const pageW = doc.internal.pageSize.getWidth()   // 210
      const totLam = lams.reduce((s,l)=>s+calcLamina(l),0)
      const totRet = rets.reduce((s,r)=>s+calcRetalho(r),0)

      // ── Cabeçalho estilo planilha ──
      doc.setFillColor(6,13,26); doc.rect(0,0,pageW,22,'F')
      await addLogoOnBand(doc, 22)
      doc.setTextColor(249,115,22); doc.setFontSize(13); doc.setFont('helvetica','bold')
      doc.text('SAÍDA — ROMANEIO DE LÂMINA', 12, 10)
      doc.setTextColor(226,232,240); doc.setFontSize(8); doc.setFont('helvetica','normal')
      doc.text(`Nº ${rom.numero}   Data: ${String(rom.data).split('-').reverse().join('/')}   Cliente: ${clienteNome}   Motorista: ${rom.motorista||'—'}   Placa: ${rom.placa||'—'}`, 12, 17)

      // ── Duas colunas lado a lado ──
      const marginL = 8
      const gap = 4
      const colW = (pageW - marginL*2 - gap) / 2     // largura de cada coluna
      const startY = 26
      const fs = 6.5   // fonte pequena p/ caber tudo numa folha

      // LÂMINAS (esquerda)
      autoTable(doc, {
        startY,
        margin: { left: marginL },
        tableWidth: colW,
        head: [['#','Esp','Comp','Larg','Folhas','m³']],
        body: lams.map((l,i)=>[String(i+1), String(l.espessura_mm), String(l.comprimento), String(l.largura), String(l.n_folhas), n3(calcLamina(l))]),
        foot: [['','','','','LÂMINA', n3(totLam)]],
        theme:'grid',
        headStyles:{fillColor:[249,115,22],fontSize:fs,halign:'center',cellPadding:1},
        bodyStyles:{fontSize:fs,cellPadding:0.8,textColor:[20,20,20]},
        footStyles:{fillColor:[30,58,95],textColor:[255,255,255],fontSize:fs,halign:'right',cellPadding:1},
        columnStyles:{0:{cellWidth:7,halign:'center'},5:{halign:'right'}},
        styles:{lineColor:[160,160,160],lineWidth:0.1},
      })
      const endLam = (doc as any).lastAutoTable.finalY

      // RETALHO (direita)
      autoTable(doc, {
        startY,
        margin: { left: marginL + colW + gap },
        tableWidth: colW,
        head: [['#','Altura','Comp','Larg','m³']],
        body: rets.map((r,i)=>[String(i+1), String(r.altura), String(r.comprimento), String(r.largura), n3(calcRetalho(r))]),
        foot: [['','','','RETALHO', n3(totRet)]],
        theme:'grid',
        headStyles:{fillColor:[249,115,22],fontSize:fs,halign:'center',cellPadding:1},
        bodyStyles:{fontSize:fs,cellPadding:0.8,textColor:[20,20,20]},
        footStyles:{fillColor:[30,58,95],textColor:[255,255,255],fontSize:fs,halign:'right',cellPadding:1},
        columnStyles:{0:{cellWidth:7,halign:'center'},4:{halign:'right'}},
        styles:{lineColor:[160,160,160],lineWidth:0.1},
      })
      const endRet = (doc as any).lastAutoTable.finalY

      // ── Rodapé: carga total + chapa + assinatura ──
      let y = Math.max(endLam, endRet) + 8
      const pageH = doc.internal.pageSize.getHeight()
      if (y > pageH - 30) y = pageH - 30   // garante que cabe na folha
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
    const lams = (itens||[]).filter((i:any)=>i.tipo==='lamina').map((i:any)=>({espessura_mm:i.espessura_mm,comprimento:i.comprimento,largura:i.largura,n_folhas:i.n_folhas}))
    const rets = (itens||[]).filter((i:any)=>i.tipo==='retalho').map((i:any)=>({altura:i.altura,comprimento:i.comprimento,largura:i.largura}))
    await gerarPDF(rom, lams, rets, rom.cliente_nome)
  }

  async function excluirRomaneio(rom:any) {
    if (!await confirm(`Excluir o romaneio #${rom.numero}? A venda lançada também será removida. Esta ação não pode ser desfeita.`)) return
    // remove a venda vinculada (se houver)
    if (rom.sale_order_id) await supabase.from('sales_orders').delete().eq('id', rom.sale_order_id)
    // itens caem por cascade; remove o cabeçalho
    await supabase.from('romaneios_lamina_itens').delete().eq('romaneio_id', rom.id)
    const { error } = await supabase.from('romaneios_lamina').delete().eq('id', rom.id)
    if (error) { toast.error('Erro ao excluir: '+error.message); return }
    toast.success(`Romaneio #${rom.numero} excluído`)
    loadHistorico()
  }

  const inStyle: React.CSSProperties = { width:'100%', background:'var(--s2)', border:'1px solid var(--bd)', borderRadius:'6px', padding:'5px 6px', color:'var(--t1)', fontSize:'11px', outline:'none' }

  return (
    <div style={ maximizado
      ? { position:'fixed', inset:0, zIndex:90, background:'var(--bg)', overflowY:'auto', padding:'0', paddingTop:'var(--sat)' }
      : { padding:'14px' } }>

      {/* Barra fixa do modo maximizado — sempre visível, com botão SAIR */}
      {maximizado && (
        <div style={{position:'sticky',top:0,zIndex:5,background:'var(--s1)',borderBottom:'1px solid var(--bd)',
          boxShadow:'0 2px 10px -4px rgba(0,0,0,.2)',padding:'10px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
          <div style={{fontSize:'13px',fontWeight:800,color:'var(--t1)'}}>🪵 Romaneio de Lâmina</div>
          <Btn onClick={()=>setMaximizado(false)} size="md" variant="primary">✕ Sair da tela cheia</Btn>
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
          {/* Cabeçalho — oculto no modo maximizado p/ focar no lançamento */}
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
            <Input label="Chapa (qtd)" type="number" value={cab.chapa_qtd} onChange={(v:string)=>setCab({...cab,chapa_qtd:v})} />
            <Input label="Chapinha" value={cab.chapa_medida} onChange={(v:string)=>setCab({...cab,chapa_medida:v})} placeholder="Ex: 1,30" />
          </div>
          </>}

          {/* No modo maximizado: cabeçalho compacto (Cliente + Placa + Motorista) */}
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

          {/* Grade LÂMINAS */}
          <div className="rounded-xl p-2.5 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'var(--cy)',marginBottom:'6px'}}>📏 LÂMINAS <span style={{color:'var(--t3)',fontWeight:400}}>(folhas × comp × larg × esp/1000)</span></div>
            <div className="grid gap-1" style={{gridTemplateColumns:'20px 1fr 1fr 1fr 1fr 70px 22px'}}>
              <div style={hdr}>#</div><div style={hdr}>Esp(mm)</div><div style={hdr}>Comp</div><div style={hdr}>Larg</div><div style={hdr}>Folhas</div><div style={{...hdr,textAlign:'right'}}>m³</div><div></div>
              {laminas.map((l,i)=>(
                <div key={i} style={{display:'contents'}}>
                  <div style={cel}>{i+1}</div>
                  <input style={inStyle} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.espessura_mm} onChange={e=>setLam(i,'espessura_mm',e.target.value)} />
                  <input style={inStyle} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.comprimento} onChange={e=>setLam(i,'comprimento',e.target.value)} />
                  <input style={inStyle} type="text" inputMode="decimal" pattern="[0-9.,]*" value={l.largura} onChange={e=>setLam(i,'largura',e.target.value)} />
                  <input style={inStyle} type="text" inputMode="numeric" pattern="[0-9]*" value={l.n_folhas} onChange={e=>setLam(i,'n_folhas',e.target.value)} />
                  <div style={{...cel,textAlign:'right',color:'var(--gn)',fontWeight:600}}>{n3(calcLamina(l))}</div>
                  <button onClick={()=>delLam(i)} style={{color:'var(--rd)',fontSize:'13px'}}>✕</button>
                </div>
              ))}
            </div>
            <Btn onClick={addLam} size="sm" variant="secondary" className="mt-2">+ Linha</Btn>
          </div>

          {/* Grade RETALHO */}
          <div className="rounded-xl p-2.5 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'var(--cy)',marginBottom:'6px'}}>♻️ RETALHO <span style={{color:'var(--t3)',fontWeight:400}}>(altura × comp × larg)</span></div>
            <div className="grid gap-1" style={{gridTemplateColumns:'20px 1fr 1fr 1fr 70px 22px'}}>
              <div style={hdr}>#</div><div style={hdr}>Altura</div><div style={hdr}>Comp</div><div style={hdr}>Larg</div><div style={{...hdr,textAlign:'right'}}>m³</div><div></div>
              {retalhos.map((r,i)=>(
                <div key={i} style={{display:'contents'}}>
                  <div style={cel}>{i+1}</div>
                  <input style={inStyle} type="text" inputMode="decimal" pattern="[0-9.,]*" value={r.altura} onChange={e=>setRet(i,'altura',e.target.value)} />
                  <input style={inStyle} type="text" inputMode="decimal" pattern="[0-9.,]*" value={r.comprimento} onChange={e=>setRet(i,'comprimento',e.target.value)} />
                  <input style={inStyle} type="text" inputMode="decimal" pattern="[0-9.,]*" value={r.largura} onChange={e=>setRet(i,'largura',e.target.value)} />
                  <div style={{...cel,textAlign:'right',color:'var(--gn)',fontWeight:600}}>{n3(calcRetalho(r))}</div>
                  <button onClick={()=>delRet(i)} style={{color:'var(--rd)',fontSize:'13px'}}>✕</button>
                </div>
              ))}
            </div>
            <Btn onClick={addRet} size="sm" variant="secondary" className="mt-2">+ Linha</Btn>
          </div>

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

const hdr: React.CSSProperties = { fontSize:'8px', color:'var(--t3)', textTransform:'uppercase', fontWeight:700, padding:'2px' }
const cel: React.CSSProperties = { fontSize:'11px', color:'var(--t2)', display:'flex', alignItems:'center', justifyContent:'center' }
