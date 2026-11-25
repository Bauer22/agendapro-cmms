'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SH, Empty, KPI } from '@/components/ui'

type Props = { profile?: any; can?: any }

const n3 = (v:number)=> (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})

const TIPOS = [
  { cat:'capa',           label:'CAPA',           cor:'#2f9e5a' },
  { cat:'capinha',        label:'CAPINHA',        cor:'#3b82f6' },
  { cat:'retalho',        label:'RETALHO',        cor:'#e8a21c' },
  { cat:'aproveitamento', label:'APROVEITAMENTO', cor:'#8b5cf6' },
]

export default function EstoqueLaminaPage({ profile }: Props) {
  const [linhas, setLinhas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    // a view já filtra por RLS/empresa; não precisa passar company_id
    const { data } = await supabase.from('v_estoque_lamina').select('*')
    setLinhas(data||[])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  // mapeia por tipo (garante ordem e tipos faltantes = 0)
  const porTipo: Record<string,any> = {}
  linhas.forEach(l=>{ porTipo[l.tipo] = l })

  const saldoTotal   = TIPOS.reduce((s,t)=> s + (Number(porTipo[t.cat]?.saldo_m3)||0), 0)
  const entradaTotal = TIPOS.reduce((s,t)=> s + (Number(porTipo[t.cat]?.entrada_m3)||0), 0)
  const saidaTotal   = TIPOS.reduce((s,t)=> s + (Number(porTipo[t.cat]?.saida_m3)||0), 0)

  return (
    <div style={{padding:'14px'}}>
      <SH label="📦 ESTOQUE DE LÂMINA (m³)" action={
        <button onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{background:'var(--s1)',color:'var(--t2)',border:'1px solid var(--bd)'}}>🔄 Atualizar</button>
      } />

      {/* Totais gerais */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KPI num={n3(entradaTotal)} label="Entrou (produção)" color="green" />
        <KPI num={n3(saidaTotal)}   label="Saiu (romaneios)"  color="amber" />
        <KPI num={n3(saldoTotal)}   label="Saldo atual m³"    color="teal" />
      </div>

      {loading ? <Empty icon="⏳" text="Carregando estoque..." /> : (
        <div className="flex flex-col gap-2">
          {TIPOS.map(t=>{
            const r = porTipo[t.cat] || {}
            const saldo = Number(r.saldo_m3)||0
            const entrada = Number(r.entrada_m3)||0
            const saida = Number(r.saida_m3)||0
            return (
              <div key={t.cat} className="rounded-xl p-3" style={{background:'var(--s1)',border:`2px solid ${t.cor}`,boxShadow:'var(--shadow)'}}>
                <div className="flex justify-between items-center">
                  <div style={{fontSize:'14px',fontWeight:800,color:t.cor}}>{t.label}</div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'9px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px'}}>Saldo</div>
                    <div style={{fontSize:'22px',fontWeight:800,color: saldo<0 ? 'var(--rd)' : 'var(--gn)',lineHeight:1}}>{n3(saldo)} <span style={{fontSize:'12px'}}>m³</span></div>
                  </div>
                </div>
                <div className="flex gap-4 mt-2" style={{fontSize:'11px',color:'var(--t2)'}}>
                  <span>⬆️ Entrou: <b style={{color:'var(--gn)'}}>{n3(entrada)}</b></span>
                  <span>⬇️ Saiu: <b style={{color:'var(--am)'}}>{n3(saida)}</b></span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{fontSize:'10px',color:'var(--t3)',marginTop:'12px',lineHeight:1.5}}>
        Saldo = produção lançada (entrada) − romaneios de saída (saída), por tipo de lâmina.
        Atualiza sozinho conforme você lança produção e gera romaneios.
      </div>
    </div>
  )
}
