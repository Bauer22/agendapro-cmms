'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge } from '@/components/ui'
import type { UserProfile } from '@/types'
import toast from 'react-hot-toast'

export default function FretePage({ profile }: { profile: UserProfile }) {
  const [saldos, setSaldos]       = useState<any[]>([])
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [fretes, setFretes]       = useState<any[]>([])   // cargas com frete (histórico de débitos)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [busca, setBusca]         = useState('')
  const [payModal, setPayModal]   = useState(false)
  const [pay, setPay]             = useState<any>({})
  const [detalhe, setDetalhe]     = useState<any>(null)   // transportadora selecionada para ver histórico
  const [aba, setAba]             = useState<'conta'|'relatorio'>('conta')
  const [relTransp, setRelTransp] = useState('')
  const [relFrom, setRelFrom]     = useState('')
  const [relTo, setRelTo]         = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [s, p, fv, fm] = await Promise.all([
      supabase.from('v_saldo_frete').select('*'),
      supabase.from('frete_pagamentos').select('*').order('payment_date', { ascending: false }),
      supabase.from('sales_orders').select('sale_date,transportadora_nome,weight_tons,frete_ton,frete_total,client_name,product_name').eq('status','active').gt('frete_total',0),
      supabase.from('wood_entries').select('data_entrada,transportadora_nome,weight_tons,frete_ton,frete_total,supplier_name').gt('frete_total',0),
    ])
    if (s.error) { toast.error('Execute o SQL da conta corrente de frete'); setLoading(false); return }
    setSaldos(s.data || [])
    setPagamentos(p.data || [])
    // Combinar fretes das duas fontes como "débitos"
    const cargas = [
      ...(fv.data||[]).map((x:any)=>({ data:x.sale_date, transportadora:(x.transportadora_nome||'').toUpperCase().trim(), tons:x.weight_tons, frete_ton:x.frete_ton, total:x.frete_total, ref:'Venda '+(x.client_name||''), origem:'venda' })),
      ...(fm.data||[]).map((x:any)=>({ data:x.data_entrada, transportadora:(x.transportadora_nome||'').toUpperCase().trim(), tons:x.weight_tons, frete_ton:x.frete_ton, total:x.frete_total, ref:'Madeira '+(x.supplier_name||''), origem:'madeira' })),
    ]
    setFretes(cargas)
    setLoading(false)
  }

  async function salvarPagamento() {
    if (saving) return
    if (!pay.transportadora) { toast.error('Selecione a transportadora'); return }
    if (!pay.value || parseFloat(String(pay.value)) <= 0) { toast.error('Informe o valor'); return }
    if (!pay.payment_date) { toast.error('Informe a data'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('frete_pagamentos').insert({
        transportadora_nome: pay.transportadora,
        payment_date: pay.payment_date,
        value: parseFloat(String(pay.value)),
        method: pay.method || null,
        notes: pay.notes || null,
        company_id: profile?.company_id || null,
        created_by: profile?.display_name || profile?.email || '',
      })
      if (error) throw error
      toast.success('Pagamento de frete lançado ✅')
      setPayModal(false); setPay({}); load()
    } catch(e:any) { toast.error('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  const money = (v:any) => 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})
  const fmtD = (d:string) => d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR') : '—'

  if (loading) return <Empty icon="⏳" text="Carregando conta corrente de frete..." />

  const termo = busca.trim().toLowerCase()
  const saldosFiltrados = !termo ? saldos : saldos.filter((s:any)=>(s.transportadora||'').toLowerCase().includes(termo))

  // Histórico de uma transportadora (débitos = fretes, créditos = pagamentos)
  const histTransp = detalhe ? (() => {
    const nome = (detalhe.transportadora||'').toUpperCase().trim()
    const debitos = fretes.filter((f:any)=>f.transportadora===nome).map((f:any)=>({data:f.data, tipo:'Frete', valor:f.total, desc:`${f.ref} · ${f.tons}t × ${money(f.frete_ton)}`}))
    const creditos = pagamentos.filter((p:any)=>(p.transportadora_nome||'').toUpperCase().trim()===nome).map((p:any)=>({data:p.payment_date, tipo:'Pagamento', valor:-p.value, desc:p.method||'Pagamento'}))
    return [...debitos, ...creditos].sort((a,b)=>(b.data||'').localeCompare(a.data||''))
  })() : []

  // ── Dados do relatório de uma transportadora no período ──
  function dadosRelatorio() {
    const nome = (relTransp||'').toUpperCase().trim()
    const noPeriodo = (d:string) => (!relFrom || d>=relFrom) && (!relTo || d<=relTo)
    const cargas = fretes.filter((f:any)=>f.transportadora===nome && noPeriodo(f.data))
                         .sort((a:any,b:any)=>(a.data||'').localeCompare(b.data||''))
    const pagos = pagamentos.filter((p:any)=>(p.transportadora_nome||'').toUpperCase().trim()===nome && noPeriodo(p.payment_date))
                            .sort((a:any,b:any)=>(a.payment_date||'').localeCompare(b.payment_date||''))
    const totCargas = cargas.length
    const totTons = cargas.reduce((s:number,f:any)=>s+(+f.tons||0),0)
    const totFrete = cargas.reduce((s:number,f:any)=>s+(+f.total||0),0)
    const totPago = pagos.reduce((s:number,p:any)=>s+(+p.value||0),0)
    // Saldo geral da transportadora (não só do período) — da view
    const sv = saldos.find((s:any)=>(s.transportadora||'').toUpperCase().trim()===nome)
    const saldoGeral = sv ? +sv.saldo : (totFrete - totPago)
    return { nome, cargas, pagos, totCargas, totTons, totFrete, totPago, saldoGeral }
  }

  function imprimirRelatorio() {
    if (!relTransp) { toast.error('Selecione a transportadora'); return }
    const r = dadosRelatorio()
    const esc = (s:any) => String(s==null?'':s).replace(/[&<>"']/g, (c:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
    const periodo = (relFrom||relTo) ? `Período: ${relFrom?fmtD(relFrom):'início'} a ${relTo?fmtD(relTo):'hoje'}` : 'Todo o período'
    const th='padding:6px 8px;background:#1e3a6e;color:#fff;font-size:11px;text-align:left'
    const td2='padding:5px 8px;border-bottom:1px solid #ddd;font-size:11px'
    const linhasCargas = r.cargas.map((f:any)=>`<tr><td style="${td2}">${fmtD(f.data)}</td><td style="${td2}">${esc(f.ref)}</td><td style="${td2};text-align:right">${(+f.tons).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td style="${td2};text-align:right">${money(f.frete_ton)}</td><td style="${td2};text-align:right">${money(f.total)}</td></tr>`).join('')
    const linhasPagos = r.pagos.map((p:any)=>`<tr><td style="${td2}">${fmtD(p.payment_date)}</td><td style="${td2}">${esc(p.method||'—')}</td><td style="${td2};text-align:right">${money(p.value)}</td></tr>`).join('')
    const html = `<html><head><title>Relatório de Frete</title></head><body style="font-family:Arial,sans-serif;max-width:800px;margin:20px auto;color:#111">
      <div style="background:#060d1a;color:#fff;padding:16px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#f97316">Relatório de Frete — ${esc(r.nome)}</h2>
        <div style="font-size:12px;color:#ccc">${periodo} · Emitido em ${new Date().toLocaleString('pt-BR')}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:12px"><tbody>
        <tr><td style="${td2};color:#555">Viagens (cargas)</td><td style="${td2};text-align:right;font-weight:bold">${r.totCargas}</td></tr>
        <tr><td style="${td2};color:#555">Toneladas transportadas</td><td style="${td2};text-align:right;font-weight:bold">${r.totTons.toLocaleString('pt-BR',{minimumFractionDigits:2})} t</td></tr>
        <tr><td style="${td2};color:#555">Frete do período</td><td style="${td2};text-align:right;font-weight:bold">${money(r.totFrete)}</td></tr>
        <tr><td style="${td2};color:#555">Pago no período</td><td style="${td2};text-align:right;font-weight:bold">${money(r.totPago)}</td></tr>
        <tr><td style="${td2};color:#555">SALDO ATUAL (conta corrente)</td><td style="${td2};text-align:right;font-weight:bold;color:#c0392b">${money(r.saldoGeral)}</td></tr>
      </tbody></table>
      <h3 style="margin-top:24px;color:#1e3a6e">Viagens / Cargas (${r.totCargas})</h3>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th style="${th}">Data</th><th style="${th}">Referência</th><th style="${th};text-align:right">Ton</th><th style="${th};text-align:right">R$/t</th><th style="${th};text-align:right">Frete</th></tr></thead>
      <tbody>${linhasCargas}<tr><td colspan="2" style="${td2};font-weight:bold;text-align:right">TOTAL</td><td style="${td2};text-align:right;font-weight:bold">${r.totTons.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td></td><td style="${td2};text-align:right;font-weight:bold">${money(r.totFrete)}</td></tr></tbody></table>
      ${r.pagos.length? `<h3 style="margin-top:24px;color:#1e8449">Pagamentos (${r.pagos.length})</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="${th}">Data</th><th style="${th}">Forma</th><th style="${th};text-align:right">Valor</th></tr></thead><tbody>${linhasPagos}<tr><td colspan="2" style="${td2};font-weight:bold;text-align:right">TOTAL PAGO</td><td style="${td2};text-align:right;font-weight:bold">${money(r.totPago)}</td></tr></tbody></table>`:''}
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(), 300) }
  }

  const totalDevido = saldos.reduce((s,x)=>s+(+x.frete_devido||0),0)
  const totalPago = saldos.reduce((s,x)=>s+(+x.total_pago||0),0)
  const totalSaldo = saldos.reduce((s,x)=>s+(+x.saldo||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SH>🚚 Frete</SH>
        {aba==='conta' && <Btn onClick={()=>{setPay({payment_date:new Date().toISOString().slice(0,10)});setPayModal(true)}} variant="primary" size="sm">+ Lançar Pagamento</Btn>}
      </div>

      {/* Abas */}
      <div className="flex gap-1.5 mb-3">
        {([['conta','💰 Conta Corrente'],['relatorio','📄 Relatórios']] as [any,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setAba(t)} className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border"
            style={{background:aba===t?'var(--cy)':'transparent',color:aba===t?'#000':'var(--t2)',borderColor:aba===t?'var(--cy)':'var(--bd)',fontFamily:'Sora,system-ui,sans-serif'}}>{l}</button>
        ))}
      </div>

      {aba==='relatorio' && (() => {
        const r = relTransp ? dadosRelatorio() : null
        return (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-4" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'var(--t1)',marginBottom:'10px'}}>📄 Relatório de Frete por Transportadora</div>
              <Select label="Transportadora" value={relTransp} onChange={(v:string)=>setRelTransp(v)}
                options={[{value:'',label:'Selecione...'}, ...saldos.map((s:any)=>({value:s.transportadora,label:s.transportadora}))]} />
              <div className="grid grid-cols-2 gap-x-3">
                <Input label="De" type="date" value={relFrom} onChange={(v:string)=>setRelFrom(v)} />
                <Input label="Até" type="date" value={relTo} onChange={(v:string)=>setRelTo(v)} />
              </div>
              {relTransp && <Btn onClick={imprimirRelatorio} size="md" variant="secondary">🖨️ Imprimir / PDF</Btn>}
            </div>

            {r && (
              <div className="rounded-2xl p-4" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
                <div style={{fontSize:'13px',fontWeight:700,color:'var(--cy)',marginBottom:'10px'}}>{r.nome}</div>
                <div className="grid grid-cols-2 gap-2 mb-3" style={{fontSize:'11px'}}>
                  <div><div style={{color:'var(--t3)'}}>Viagens</div><div style={{fontWeight:700,color:'var(--t1)'}}>{r.totCargas}</div></div>
                  <div><div style={{color:'var(--t3)'}}>Toneladas</div><div style={{fontWeight:700,color:'var(--t1)'}}>{r.totTons.toLocaleString('pt-BR',{minimumFractionDigits:2})} t</div></div>
                  <div><div style={{color:'var(--t3)'}}>Frete do período</div><div style={{fontWeight:700,color:'var(--rd)'}}>{money(r.totFrete)}</div></div>
                  <div><div style={{color:'var(--t3)'}}>Pago no período</div><div style={{fontWeight:700,color:'var(--gn)'}}>{money(r.totPago)}</div></div>
                  <div style={{gridColumn:'span 2'}}><div style={{color:'var(--t3)'}}>Saldo atual (conta corrente)</div><div style={{fontWeight:700,fontSize:'14px',color:'var(--cy)'}}>{money(r.saldoGeral)}</div></div>
                </div>
                <div style={{fontSize:'11px',fontWeight:700,color:'var(--t2)',marginBottom:'4px'}}>Viagens / Cargas</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
                    <thead><tr style={{background:'var(--s2)'}}><th style={{padding:'4px 6px',textAlign:'left',color:'var(--t2)'}}>Data</th><th style={{padding:'4px 6px',textAlign:'left',color:'var(--t2)'}}>Ref.</th><th style={{padding:'4px 6px',textAlign:'right',color:'var(--t2)'}}>Ton</th><th style={{padding:'4px 6px',textAlign:'right',color:'var(--t2)'}}>R$/t</th><th style={{padding:'4px 6px',textAlign:'right',color:'var(--t2)'}}>Frete</th></tr></thead>
                    <tbody>{r.cargas.map((f:any,i:number)=>(<tr key={i} style={{borderBottom:'1px solid var(--bd)'}}><td style={{padding:'4px 6px',color:'var(--t1)'}}>{fmtD(f.data)}</td><td style={{padding:'4px 6px',color:'var(--t3)'}}>{f.ref}</td><td style={{padding:'4px 6px',textAlign:'right',color:'var(--t1)'}}>{(+f.tons).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td style={{padding:'4px 6px',textAlign:'right',color:'var(--t1)'}}>{money(f.frete_ton)}</td><td style={{padding:'4px 6px',textAlign:'right',color:'var(--t1)'}}>{money(f.total)}</td></tr>))}
                      <tr style={{background:'var(--s2)',fontWeight:700}}><td colSpan={2} style={{padding:'4px 6px',textAlign:'right',color:'var(--t1)'}}>TOTAL</td><td style={{padding:'4px 6px',textAlign:'right',color:'var(--t1)'}}>{r.totTons.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td></td><td style={{padding:'4px 6px',textAlign:'right',color:'var(--rd)'}}>{money(r.totFrete)}</td></tr>
                    </tbody>
                  </table>
                </div>
                {r.pagos.length>0 && (<>
                  <div style={{fontSize:'11px',fontWeight:700,color:'var(--gn)',margin:'12px 0 4px'}}>Pagamentos</div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
                    <thead><tr style={{background:'var(--s2)'}}><th style={{padding:'4px 6px',textAlign:'left',color:'var(--t2)'}}>Data</th><th style={{padding:'4px 6px',textAlign:'left',color:'var(--t2)'}}>Forma</th><th style={{padding:'4px 6px',textAlign:'right',color:'var(--t2)'}}>Valor</th></tr></thead>
                    <tbody>{r.pagos.map((p:any,i:number)=>(<tr key={i} style={{borderBottom:'1px solid var(--bd)'}}><td style={{padding:'4px 6px',color:'var(--t1)'}}>{fmtD(p.payment_date)}</td><td style={{padding:'4px 6px',color:'var(--t3)'}}>{p.method||'—'}</td><td style={{padding:'4px 6px',textAlign:'right',color:'var(--gn)'}}>{money(p.value)}</td></tr>))}</tbody>
                  </table>
                </>)}
              </div>
            )}
          </div>
        )
      })()}

      {aba==='conta' && (<>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div style={{fontSize:'9px',color:'var(--t3)',textTransform:'uppercase'}}>Frete devido</div>
          <div style={{fontSize:'14px',fontWeight:700,color:'var(--rd)'}}>{money(totalDevido)}</div>
        </div>
        <div className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div style={{fontSize:'9px',color:'var(--t3)',textTransform:'uppercase'}}>Pago</div>
          <div style={{fontSize:'14px',fontWeight:700,color:'var(--gn)'}}>{money(totalPago)}</div>
        </div>
        <div className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
          <div style={{fontSize:'9px',color:'var(--t3)',textTransform:'uppercase'}}>Saldo a pagar</div>
          <div style={{fontSize:'14px',fontWeight:700,color:'var(--cy)'}}>{money(totalSaldo)}</div>
        </div>
      </div>

      <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar transportadora..."
        className="w-full rounded-xl px-3 py-2 text-xs outline-none mb-3"
        style={{background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t1)',fontFamily:'Sora,system-ui,sans-serif'}} />

      {saldosFiltrados.length === 0 ? <Empty icon="🚚" text="Nenhum frete lançado ainda." /> : (
        <div className="flex flex-col gap-2">
          {saldosFiltrados.map((s:any,i:number)=>(
            <div key={i} onClick={()=>setDetalhe(s)} className="rounded-xl p-3 cursor-pointer" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
              <div className="flex items-center justify-between mb-1">
                <span style={{fontSize:'13px',fontWeight:700,color:'var(--t1)'}}>{s.transportadora}</span>
                <Badge color={s.saldo>0?'red':'green'}>{s.saldo>0?'A PAGAR':'QUITADO'}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-1" style={{fontSize:'10px'}}>
                <div><div style={{color:'var(--t3)'}}>Cargas</div><div style={{color:'var(--t1)'}}>{s.cargas}</div></div>
                <div><div style={{color:'var(--t3)'}}>Frete devido</div><div style={{color:'var(--rd)'}}>{money(s.frete_devido)}</div></div>
                <div><div style={{color:'var(--t3)'}}>Pago</div><div style={{color:'var(--gn)'}}>{money(s.total_pago)}</div></div>
                <div><div style={{color:'var(--t3)'}}>Saldo</div><div style={{fontWeight:700,color:'var(--cy)'}}>{money(s.saldo)}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}

      </>)}

      {/* Modal lançar pagamento */}
      <Modal open={payModal} onClose={()=>setPayModal(false)} title="🚚 Lançar Pagamento de Frete"
        footer={<><Btn onClick={()=>setPayModal(false)}>Cancelar</Btn><Btn onClick={salvarPagamento} variant="primary" size="md" disabled={saving}>{saving?'Salvando...':'Salvar'}</Btn></>}>
        <Select label="Transportadora *" value={pay.transportadora||''} onChange={(v:string)=>setPay((e:any)=>({...e,transportadora:v}))}
          options={[{value:'',label:'Selecione...'}, ...saldos.map((s:any)=>({value:s.transportadora,label:s.transportadora}))]} />
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Valor R$ *" type="number" value={pay.value||''} onChange={(v:string)=>setPay((e:any)=>({...e,value:v}))} placeholder="0.00" />
          <Input label="Data *" type="date" value={pay.payment_date||''} onChange={(v:string)=>setPay((e:any)=>({...e,payment_date:v}))} />
        </div>
        <Select label="Forma" value={pay.method||''} onChange={(v:string)=>setPay((e:any)=>({...e,method:v}))}
          options={[{value:'',label:'—'},{value:'PIX',label:'PIX'},{value:'Transferência',label:'Transferência'},{value:'Dinheiro',label:'Dinheiro'},{value:'Boleto',label:'Boleto'},{value:'Cheque',label:'Cheque'}]} />
        <Input label="Observações" value={pay.notes||''} onChange={(v:string)=>setPay((e:any)=>({...e,notes:v}))} placeholder="Opcional" />
      </Modal>

      {/* Modal histórico da transportadora */}
      <Modal open={!!detalhe} onClose={()=>setDetalhe(null)} title={`🚚 ${detalhe?.transportadora||''}`}>
        {detalhe && (
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-3 gap-2 mb-2" style={{fontSize:'11px'}}>
              <div><div style={{color:'var(--t3)'}}>Devido</div><div style={{fontWeight:700,color:'var(--rd)'}}>{money(detalhe.frete_devido)}</div></div>
              <div><div style={{color:'var(--t3)'}}>Pago</div><div style={{fontWeight:700,color:'var(--gn)'}}>{money(detalhe.total_pago)}</div></div>
              <div><div style={{color:'var(--t3)'}}>Saldo</div><div style={{fontWeight:700,color:'var(--cy)'}}>{money(detalhe.saldo)}</div></div>
            </div>
            <div style={{fontSize:'10px',fontWeight:700,color:'var(--t2)',textTransform:'uppercase',marginBottom:'4px'}}>Histórico</div>
            {histTransp.length===0 ? <div style={{fontSize:'11px',color:'var(--t3)'}}>Sem movimentações.</div> :
              histTransp.map((h:any,i:number)=>(
                <div key={i} className="flex justify-between py-1.5" style={{borderBottom:'1px solid var(--bd)',fontSize:'11px'}}>
                  <div>
                    <span style={{color:h.tipo==='Frete'?'var(--rd)':'var(--gn)',fontWeight:600}}>{h.tipo}</span>
                    <span style={{color:'var(--t3)',marginLeft:'6px'}}>{fmtD(h.data)}</span>
                    <div style={{color:'var(--t3)',fontSize:'9px'}}>{h.desc}</div>
                  </div>
                  <span style={{fontWeight:700,color:h.valor<0?'var(--gn)':'var(--t1)'}}>{money(Math.abs(h.valor))}</span>
                </div>
              ))
            }
          </div>
        )}
      </Modal>
    </div>
  )
}
