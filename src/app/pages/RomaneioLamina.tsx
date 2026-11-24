'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Input, Select, SelectComCadastro, SH, KPI, Empty, useConfirm } from '@/components/ui'
import { td } from '@/lib/utils'
import toast from 'react-hot-toast'

type Props = { profile?: any; can?: any }

const n3 = (v:number)=> (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})

// linha de lâmina: espessura(mm) · comprimento · largura · nº folhas → metragem(m³)
const calcLamina = (l:any)=> (Number(l.n_folhas)||0) * (Number(l.comprimento)||0) * (Number(l.largura)||0) * ((Number(l.espessura_mm)||0)/1000)
// linha de retalho: altura · comprimento · largura → metros(m³)
const calcRetalho = (r:any)=> (Number(r.altura)||0) * (Number(r.comprimento)||0) * (Number(r.largura)||0)

const linhaLaminaVazia = ()=>({ espessura_mm:'', comprimento:'', largura:'', n_folhas:'' })
const linhaRetalhoVazia = ()=>({ altura:'', comprimento:'', largura:'' })

export default function RomaneioLamina({ profile }: Props) {
  const { confirm, dialog } = useConfirm()
  const cid = profile?.company_id || null
  const [aba, setAba] = useState<'novo'|'historico'>('novo')
  const [clientes, setClientes] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])

  // cabeçalho
  const [cab, setCab] = useState<any>({ data: td(), motorista:'', cliente_id:'', placa:'', chapa_qtd:'', chapa_medida:'' })
  // grades
  const [laminas, setLaminas] = useState<any[]>([linhaLaminaVazia()])
  const [retalhos, setRetalhos] = useState<any[]>([linhaRetalhoVazia()])

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
      // 1. sequencial por empresa
      const { data: cnt } = await supabase.from('romaneio_lamina_counter')
        .upsert({ company_id: cid, ultimo: 1 }, { onConflict:'company_id', ignoreDuplicates:false })
        .select().maybeSingle()
      // incremento seguro: busca o maior numero atual +1
      const { data: ult } = await supabase.from('romaneios_lamina').select('numero').order('numero',{ascending:false}).limit(1).maybeSingle()
      const numero = ((ult?.numero)||0) + 1

      // 2. cria o cabeçalho
      const { data: rom, error: e1 } = await supabase.from('romaneios_lamina').insert({
        company_id: cid, numero, data: cab.data, motorista: cab.motorista||null,
        cliente_id: cab.cliente_id, cliente_nome: cli.nome_razao, placa: (cab.placa||'').toUpperCase()||null,
        chapa_qtd: cab.chapa_qtd? Number(cab.chapa_qtd):null, chapa_medida: cab.chapa_medida||null,
        total_lamina: totalLamina, total_retalho: totalRetalho, carga_total: cargaTotal,
        created_by: profile?.display_name||'',
      }).select().single()
      if (e1) throw e1

      // 3. grava os itens
      const itens = [
        ...lamsValidas.map((l,i)=>({ company_id:cid, romaneio_id:rom.id, tipo:'lamina', ordem:i,
          espessura_mm:Number(l.espessura_mm)||0, comprimento:Number(l.comprimento)||0, largura:Number(l.largura)||0,
          n_folhas:Number(l.n_folhas)||0, metragem:calcLamina(l) })),
        ...retsValidos.map((r,i)=>({ company_id:cid, romaneio_id:rom.id, tipo:'retalho', ordem:i,
          altura:Number(r.altura)||0, comprimento:Number(r.comprimento)||0, largura:Number(r.largura)||0,
          metragem:calcRetalho(r) })),
      ]
      if (itens.length>0) await supabase.from('romaneios_lamina_itens').insert(itens)

      // 4. lança a venda (carga total, sem preço)
      const { data: venda } = await supabase.from('sales_orders').insert({
        sale_date: cab.data, client_id: cab.cliente_id, client_name: cli.nome_razao,
        product_name: 'LÂMINA', volume_m3: cargaTotal, plate: (cab.placa||'').toUpperCase()||'—',
        driver: cab.motorista||'—', status:'active',
        romaneio_num: numero,
        notes: `Romaneio lâmina #${numero} · lâmina ${n3(totalLamina)} + retalho ${n3(totalRetalho)} m³`,
        created_by: profile?.display_name||'', created_by_id: profile?.id||null, company_id: cid,
      }).select().single()
      if (venda?.id) await supabase.from('romaneios_lamina').update({ sale_order_id: venda.id }).eq('id', rom.id)

      toast.success(`Romaneio #${numero} gerado e lançado em vendas ✅`)
      await gerarPDF({ ...rom, numero }, lamsValidas, retsValidos, cli.nome_razao)
      limpar(); setAba('historico')
    } catch(e:any){ toast.error('Erro: '+e.message) }
    finally { setSaving(false) }
  }

  async function gerarPDF(rom:any, lams:any[], rets:any[], clienteNome:string) {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const { addLogoOnBand } = await import('@/lib/pdf')
      const doc = new jsPDF()
      const pageW = doc.internal.pageSize.getWidth()
      doc.setFillColor(6,13,26); doc.rect(0,0,pageW,24,'F')
      await addLogoOnBand(doc, 24)
      doc.setTextColor(249,115,22); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('Romaneio de Saída — Lâmina', 12, 11)
      doc.setTextColor(226,232,240); doc.setFontSize(9); doc.setFont('helvetica','normal')
      doc.text(`Romaneio Nº ${rom.numero}  ·  Data: ${String(rom.data).split('-').reverse().join('/')}`, 12, 18)

      let y = 30
      doc.setTextColor(0,0,0); doc.setFontSize(9)
      doc.text(`Cliente: ${clienteNome}    Motorista: ${rom.motorista||'—'}    Placa: ${rom.placa||'—'}`, 12, y); y+=5
      doc.text(`Chapa: ${rom.chapa_qtd||'—'}    Chapa medida: ${rom.chapa_medida||'—'}`, 12, y); y+=6

      // tabela lâminas
      if (lams.length>0) {
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('Lâminas', 12, y); y+=2
        autoTable(doc, { startY:y+2,
          head:[['#','Espessura (mm)','Comprimento','Largura','Nº Folhas','Metragem (m³)']],
          body: lams.map((l,i)=>[String(i+1), String(l.espessura_mm), String(l.comprimento), String(l.largura), String(l.n_folhas), n3(calcLamina(l))]),
          theme:'grid', headStyles:{fillColor:[249,115,22],fontSize:8}, styles:{fontSize:8},
          columnStyles:{5:{halign:'right'}},
          foot:[['','','','','TOTAL LÂMINA', n3(lams.reduce((s,l)=>s+calcLamina(l),0))]],
          footStyles:{fillColor:[30,58,95],textColor:[255,255,255],fontSize:8,halign:'right'} })
        y = (doc as any).lastAutoTable.finalY + 6
      }
      // tabela retalhos
      if (rets.length>0) {
        if (y>230){doc.addPage();y=20}
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('Retalho', 12, y); y+=2
        autoTable(doc, { startY:y+2,
          head:[['#','Altura','Comprimento','Largura','Metros (m³)']],
          body: rets.map((r,i)=>[String(i+1), String(r.altura), String(r.comprimento), String(r.largura), n3(calcRetalho(r))]),
          theme:'grid', headStyles:{fillColor:[249,115,22],fontSize:8}, styles:{fontSize:8},
          columnStyles:{4:{halign:'right'}},
          foot:[['','','','TOTAL RETALHO', n3(rets.reduce((s,r)=>s+calcRetalho(r),0))]],
          footStyles:{fillColor:[30,58,95],textColor:[255,255,255],fontSize:8,halign:'right'} })
        y = (doc as any).lastAutoTable.finalY + 8
      }
      // carga total
      if (y>250){doc.addPage();y=20}
      doc.setFillColor(249,115,22); doc.rect(12, y, pageW-24, 10, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont('helvetica','bold')
      doc.text('CARGA TOTAL', 16, y+7)
      doc.text(n3(rom.carga_total)+' m³', pageW-16, y+7, {align:'right'})
      y+=18
      doc.setTextColor(60,60,60); doc.setFontSize(8); doc.setFont('helvetica','normal')
      doc.text('Assinatura: ____________________________        Recebido por: ____________________________', 12, y)
      doc.save(`romaneio_lamina_${rom.numero}.pdf`)
    } catch(e:any){ toast.error('Erro ao gerar PDF: '+e.message) }
  }

  async function reimprimir(rom:any) {
    const { data: itens } = await supabase.from('romaneios_lamina_itens').select('*').eq('romaneio_id', rom.id).order('ordem')
    const lams = (itens||[]).filter((i:any)=>i.tipo==='lamina').map((i:any)=>({espessura_mm:i.espessura_mm,comprimento:i.comprimento,largura:i.largura,n_folhas:i.n_folhas}))
    const rets = (itens||[]).filter((i:any)=>i.tipo==='retalho').map((i:any)=>({altura:i.altura,comprimento:i.comprimento,largura:i.largura}))
    await gerarPDF(rom, lams, rets, rom.cliente_nome)
  }

  const inStyle: React.CSSProperties = { width:'100%', background:'#16284a', border:'1px solid var(--bd)', borderRadius:'6px', padding:'5px 6px', color:'#fff', fontSize:'11px', outline:'none' }

  return (
    <div style={{padding:'14px'}}>
      <SH label="🪵 ROMANEIO DE SAÍDA — LÂMINA" action={
        <div className="flex gap-1.5">
          {[{k:'novo',l:'➕ Novo'},{k:'historico',l:'📚 Histórico'}].map(t=>(
            <Btn key={t.k} onClick={()=>setAba(t.k as any)} size="sm" variant={aba===t.k?'primary':'secondary'}>{t.l}</Btn>
          ))}
        </div>
      } />

      {aba==='novo' && (
        <div>
          {/* Cabeçalho */}
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
            <Input label="Chapa medida" value={cab.chapa_medida} onChange={(v:string)=>setCab({...cab,chapa_medida:v})} placeholder="Ex: 1,30" />
          </div>

          {/* Grade LÂMINAS */}
          <div className="rounded-xl p-2.5 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'var(--cy)',marginBottom:'6px'}}>📏 LÂMINAS <span style={{color:'var(--t3)',fontWeight:400}}>(folhas × comp × larg × esp/1000)</span></div>
            <div className="grid gap-1" style={{gridTemplateColumns:'20px 1fr 1fr 1fr 1fr 70px 22px'}}>
              <div style={hdr}>#</div><div style={hdr}>Esp(mm)</div><div style={hdr}>Comp</div><div style={hdr}>Larg</div><div style={hdr}>Folhas</div><div style={{...hdr,textAlign:'right'}}>m³</div><div></div>
              {laminas.map((l,i)=>(
                <div key={i} style={{display:'contents'}}>
                  <div style={cel}>{i+1}</div>
                  <input style={inStyle} type="number" value={l.espessura_mm} onChange={e=>setLam(i,'espessura_mm',e.target.value)} />
                  <input style={inStyle} type="number" value={l.comprimento} onChange={e=>setLam(i,'comprimento',e.target.value)} />
                  <input style={inStyle} type="number" value={l.largura} onChange={e=>setLam(i,'largura',e.target.value)} />
                  <input style={inStyle} type="number" value={l.n_folhas} onChange={e=>setLam(i,'n_folhas',e.target.value)} />
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
                  <input style={inStyle} type="number" value={r.altura} onChange={e=>setRet(i,'altura',e.target.value)} />
                  <input style={inStyle} type="number" value={r.comprimento} onChange={e=>setRet(i,'comprimento',e.target.value)} />
                  <input style={inStyle} type="number" value={r.largura} onChange={e=>setRet(i,'largura',e.target.value)} />
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
            <Btn onClick={gerarRomaneio} variant="primary" disabled={saving}>{saving?'Gerando...':'🪵 Gerar romaneio + lançar venda'}</Btn>
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
                  <b style={{color:'#fff',fontSize:'13px'}}>Romaneio #{r.numero}</b> <span style={{color:'var(--t3)',fontSize:'11px'}}>{String(r.data).split('-').reverse().join('/')}</span>
                  <div style={{color:'var(--t2)',fontSize:'11px'}}>{r.cliente_nome} · {r.motorista||'—'} · {r.placa||'—'}</div>
                </div>
                <div style={{textAlign:'right',fontSize:'11px',color:'var(--t2)'}}>
                  <div>Lâmina {n3(r.total_lamina)} · Retalho {n3(r.total_retalho)}</div>
                  <div><b style={{color:'var(--gn)'}}>Total {n3(r.carga_total)} m³</b></div>
                </div>
                <Btn onClick={()=>reimprimir(r)} size="sm" variant="secondary">🖨️ Reimprimir</Btn>
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
