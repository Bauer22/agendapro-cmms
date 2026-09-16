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

  const totalDevido = saldos.reduce((s,x)=>s+(+x.frete_devido||0),0)
  const totalPago = saldos.reduce((s,x)=>s+(+x.total_pago||0),0)
  const totalSaldo = saldos.reduce((s,x)=>s+(+x.saldo||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SH>🚚 Conta Corrente de Frete</SH>
        <Btn onClick={()=>{setPay({payment_date:new Date().toISOString().slice(0,10)});setPayModal(true)}} variant="primary" size="sm">+ Lançar Pagamento</Btn>
      </div>

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
