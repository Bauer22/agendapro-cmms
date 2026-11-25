'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SH, Empty, KPI } from '@/components/ui'

type Props = { profile?: any; can?: any }

const ton = (v:any)=> (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})
const money = (v:any)=> 'R$ ' + (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function EstoqueMadeiraPage({ profile }: Props) {
  const [row, setRow] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('v_estoque_madeira').select('*')
    // a view já filtra por RLS/empresa; pega a 1ª (a empresa do usuário)
    setRow((data && data[0]) || null)
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const saldo        = Number(row?.saldo_ton)||0
  const entrada      = Number(row?.entrada_ton)||0
  const saidaProd    = Number(row?.saida_prod_ton)||0
  const saidaVenda   = Number(row?.saida_venda_ton)||0
  const custoMedio   = Number(row?.custo_medio_ton)||0
  const valorEstoque = Number(row?.valor_estoque)||0

  return (
    <div style={{padding:'14px'}}>
      <SH label="🌲 ESTOQUE DE MADEIRA PINUS (ton)" action={
        <button onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{background:'var(--s1)',color:'var(--t2)',border:'1px solid var(--bd)'}}>🔄 Atualizar</button>
      } />

      {/* Totais gerais */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KPI num={ton(saldo)}         label="Saldo atual (ton)" color="teal" />
        <KPI num={money(custoMedio)}  label="Custo médio / ton" color="amber" />
        <KPI num={money(valorEstoque)} label="Valor em estoque" color="green" />
      </div>

      {loading ? <Empty icon="⏳" text="Carregando estoque..." /> : (
        <>
          {/* Card principal — saldo */}
          <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'2px solid var(--cy)',boxShadow:'var(--shadow)'}}>
            <div className="flex justify-between items-center">
              <div style={{fontSize:'14px',fontWeight:800,color:'var(--cy)'}}>🌲 MADEIRA PINUS</div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'9px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px'}}>Saldo em estoque</div>
                <div style={{fontSize:'24px',fontWeight:800,color: saldo<0 ? 'var(--rd)' : 'var(--gn)',lineHeight:1}}>{ton(saldo)} <span style={{fontSize:'13px'}}>ton</span></div>
              </div>
            </div>
          </div>

          {/* Entradas e saídas detalhadas */}
          <div className="rounded-xl p-3" style={{background:'var(--s1)',border:'1px solid var(--bd)',boxShadow:'var(--shadow)'}}>
            <div style={{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:'8px'}}>Movimentação (toneladas)</div>

            <Linha icon="⬆️" label="Entrou (compra de madeira)" valor={ton(entrada)} cor="var(--gn)" />
            <Linha icon="⬇️" label="Saiu p/ produção (tanque ÷ 1,4)" valor={'− '+ton(saidaProd)} cor="var(--am)" />
            <Linha icon="⬇️" label="Saiu em vendas de madeira" valor={'− '+ton(saidaVenda)} cor="var(--am)" />

            <div style={{height:'1px',background:'var(--bd)',margin:'8px 0'}} />
            <Linha icon="=" label="Saldo atual" valor={ton(saldo)+' ton'} cor={saldo<0?'var(--rd)':'var(--gn)'} bold />
          </div>

          <div style={{fontSize:'10px',color:'var(--t3)',marginTop:'12px',lineHeight:1.5}}>
            Entrada = compras de madeira (ton). Saída = produção (m³ do tanque ÷ 1,4) + vendas de madeira (ton).
            Custo médio = valor total das compras ÷ toneladas compradas. Atualiza sozinho conforme você lança
            compras, produção e vendas.
          </div>
        </>
      )}
    </div>
  )
}

function Linha({ icon, label, valor, cor, bold }:{ icon:string; label:string; valor:string; cor:string; bold?:boolean }) {
  return (
    <div className="flex justify-between items-center" style={{padding:'5px 0'}}>
      <span style={{fontSize:'12px',color:'var(--t2)'}}>{icon} {label}</span>
      <b style={{fontSize: bold?'14px':'12px', color:cor}}>{valor}</b>
    </div>
  )
}
