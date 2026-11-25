'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SH, Empty, KPI } from '@/components/ui'

type Props = { profile?: any; can?: any }

const ton = (v:any)=> (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})
const ton1 = (v:any)=> (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})
const money = (v:any)=> 'R$ ' + (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const mesLabel = (m:string)=> {
  const [y,mm] = (m||'').split('-')
  const nomes = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return mm ? `${nomes[+mm]||mm}/${(y||'').slice(2)}` : m
}

export default function EstoqueMadeiraPage({ profile }: Props) {
  const [linhas, setLinhas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    // lê o fechamento mensal (tem saldo inicial + custo médio móvel + frete + venda)
    const { data } = await supabase.from('estoque_madeira_mensal')
      .select('*').order('mes', { ascending: true })
    setLinhas(data || [])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  // o saldo atual = o último mês fechado
  const ultimo = linhas.length ? linhas[linhas.length-1] : null
  const saldoAtual   = Number(ultimo?.toneladas_final)||0
  const custoMedio   = Number(ultimo?.preco_medio)||0
  const valorEstoque = Number(ultimo?.valor_final)||0

  return (
    <div style={{padding:'14px'}}>
      <SH label="🌲 ESTOQUE DE MADEIRA PINUS (ton)" action={
        <button onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{background:'var(--s1)',color:'var(--t2)',border:'1px solid var(--bd)'}}>🔄 Atualizar</button>
      } />

      {/* Totais do saldo atual (último mês) */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KPI num={ton1(saldoAtual)}  label="Saldo atual (ton)" color="teal" />
        <KPI num={money(custoMedio)} label="Custo médio / ton" color="amber" />
        <KPI num={money(valorEstoque)} label="Valor em estoque" color="green" />
      </div>

      {loading ? <Empty icon="⏳" text="Carregando estoque..." /> : (
        linhas.length===0 ? <Empty icon="🌲" text="Nenhum fechamento de estoque de madeira. Lance compras e produção." /> : (
        <>
          {/* Card do saldo atual */}
          {ultimo && (
            <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'2px solid var(--cy)',boxShadow:'var(--shadow)'}}>
              <div className="flex justify-between items-center">
                <div>
                  <div style={{fontSize:'14px',fontWeight:800,color:'var(--cy)'}}>🌲 MADEIRA PINUS</div>
                  <div style={{fontSize:'10px',color:'var(--t3)'}}>Fechamento {mesLabel(ultimo.mes)}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'9px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px'}}>Saldo em estoque</div>
                  <div style={{fontSize:'24px',fontWeight:800,color: saldoAtual<0 ? 'var(--rd)' : 'var(--gn)',lineHeight:1}}>{ton1(saldoAtual)} <span style={{fontSize:'13px'}}>ton</span></div>
                  <div style={{fontSize:'11px',color:'var(--am)',fontWeight:700,marginTop:'2px'}}>{money(custoMedio)}/ton</div>
                </div>
              </div>
            </div>
          )}

          {/* Tabela mês a mês */}
          <div style={{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:'6px'}}>
            Custo médio móvel mês a mês
          </div>
          <div className="rounded-xl overflow-hidden mb-3" style={{border:'1px solid var(--bd)'}}>
            <div className="grid px-2 py-2" style={{gridTemplateColumns:'48px 1fr 1fr 70px 1fr',background:'var(--s2)',fontSize:'9px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>
              <span>Mês</span>
              <span style={{textAlign:'right'}}>Entrou</span>
              <span style={{textAlign:'right'}}>Saiu</span>
              <span style={{textAlign:'right'}}>R$/ton</span>
              <span style={{textAlign:'right'}}>Saldo</span>
            </div>
            {linhas.map((r,i)=>{
              const entrou = Number(r.toneladas_entrada)||0
              const saiu   = Number(r.toneladas_consumo)||0
              const saldo  = Number(r.toneladas_final)||0
              const custo  = Number(r.preco_medio)||0
              return (
                <div key={i} className="grid px-2 py-2" style={{gridTemplateColumns:'48px 1fr 1fr 70px 1fr',background:'var(--s1)',borderTop:'1px solid var(--bd)',fontSize:'10px'}}>
                  <span style={{color:'var(--t2)',fontWeight:700}}>{mesLabel(r.mes)}</span>
                  <span style={{textAlign:'right',color:'var(--gn)'}}>{entrou>0?ton1(entrou):'—'}</span>
                  <span style={{textAlign:'right',color:'var(--am)'}}>{saiu>0?ton1(saiu):'—'}</span>
                  <span style={{textAlign:'right',color:'var(--cy)',fontWeight:700}}>{custo>0?custo.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</span>
                  <span style={{textAlign:'right',color: saldo<0?'var(--rd)':'var(--t1)',fontWeight:700}}>{ton1(saldo)}</span>
                </div>
              )
            })}
          </div>

          <div style={{fontSize:'10px',color:'var(--t3)',lineHeight:1.5}}>
            Saldo e custo vêm do fechamento mensal (custo médio móvel): saldo do mês anterior + compras (madeira + frete)
            − produção (m³ tanque ÷ 1,4) − vendas de madeira. O <b>R$/ton</b> de cada mês é o custo que alimenta a produção.
          </div>
        </>
        )
      )}
    </div>
  )
}
