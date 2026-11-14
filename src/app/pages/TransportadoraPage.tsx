'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SelectComCadastro, Textarea, SH, Empty, Badge, KPI, useConfirm } from '@/components/ui'

type Props = { profile?: any; can?: any }

const money = (v: any) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dBR = (d: any) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'

export default function TransportadoraPage({ profile }: Props) {
  const { confirm, dialog } = useConfirm()
  const [tab, setTab] = useState<'viagens' | 'frota' | 'manutencao'>('viagens')
  const [loading, setLoading] = useState(false)

  const [viagens, setViagens] = useState<any[]>([])
  const [veiculos, setVeiculos] = useState<any[]>([])
  const [manut, setManut] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])

  const [viagemModal, setViagemModal] = useState(false)
  const [viagem, setViagem] = useState<any>(null)
  const [manutModal, setManutModal] = useState(false)
  const [manutItem, setManutItem] = useState<any>(null)
  const [fatModal, setFatModal] = useState<any>(null) // viagem a faturar
  const [dueDate, setDueDate] = useState('')

  const cid = profile?.company_id || null

  async function load() {
    setLoading(true)
    try {
      if (tab === 'viagens') {
        const [v, cl, ve] = await Promise.all([
          supabase.from('v_viagens_resumo').select('*').order('data_saida', { ascending: false }),
          supabase.from('cadastros').select('id,nome_razao').eq('is_cliente', true).eq('status', true).order('nome_razao'),
          supabase.from('veiculos').select('id,placa,tipo,motorista_padrao').order('placa'),
        ])
        setViagens(v.data || []); setClientes(cl.data || []); setVeiculos(ve.data || [])
      } else if (tab === 'frota') {
        const { data } = await supabase.from('veiculos').select('*').order('placa')
        setVeiculos(data || [])
      } else {
        const [m, ve] = await Promise.all([
          supabase.from('fleet_maintenance').select('*').order('data', { ascending: false }),
          supabase.from('veiculos').select('id,placa,tipo').order('placa'),
        ])
        setManut(m.data || []); setVeiculos(ve.data || [])
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tab])

  // ─── VIAGEM ────────────────────────────────────────────────
  function novaViagem() {
    setViagem({ veiculo_id: '', motorista: '', cliente_id: '', origem: '', destino: '', numero_cte: '', numero_nf: '', data_saida: new Date().toISOString().slice(0, 10), valor_frete: '', pedagio: '', diarias: '', outras_despesas: '', observacao: '' })
    setViagemModal(true)
  }

  async function salvarViagem() {
    if (!viagem?.cliente_id) { alert('Selecione o cliente'); return }
    const ve = veiculos.find(x => x.id === viagem.veiculo_id)
    const cl = clientes.find(x => x.id === viagem.cliente_id)
    const obj = {
      company_id: cid,
      veiculo_id: viagem.veiculo_id || null,
      placa: ve?.placa || null,
      motorista: viagem.motorista || ve?.motorista_padrao || null,
      cliente_id: viagem.cliente_id,
      cliente_nome: cl?.nome_razao || null,
      origem: viagem.origem || null,
      destino: viagem.destino || null,
      numero_cte: viagem.numero_cte || null,
      numero_nf: viagem.numero_nf || null,
      data_saida: viagem.data_saida,
      valor_frete: Number(viagem.valor_frete) || 0,
      pedagio: Number(viagem.pedagio) || 0,
      diarias: Number(viagem.diarias) || 0,
      outras_despesas: Number(viagem.outras_despesas) || 0,
      observacao: viagem.observacao || null,
      created_by: profile?.display_name || '',
    }
    const res = viagem.id
      ? await supabase.from('trips').update(obj).eq('id', viagem.id)
      : await supabase.from('trips').insert(obj)
    if (res.error) { alert('Erro: ' + res.error.message); return }
    setViagemModal(false); setViagem(null); load()
  }

  async function faturarViagem() {
    if (!fatModal) return
    const { error } = await supabase.rpc('faturar_viagem', {
      p_trip: fatModal.id,
      p_due: dueDate || null,
      p_user: profile?.display_name || '',
    })
    if (error) { alert('Erro ao faturar: ' + error.message); return }
    setFatModal(null); setDueDate(''); load()
  }

  // ─── MANUTENÇÃO ────────────────────────────────────────────
  function novaManut() {
    setManutItem({ veiculo_id: '', tipo: 'preventiva', descricao: '', km: '', valor: '', fornecedor: '', data: new Date().toISOString().slice(0, 10), proxima_data: '', observacao: '' })
    setManutModal(true)
  }

  async function salvarManut() {
    if (!manutItem?.veiculo_id) { alert('Selecione o veículo'); return }
    const ve = veiculos.find(x => x.id === manutItem.veiculo_id)
    const obj = {
      company_id: cid,
      veiculo_id: manutItem.veiculo_id,
      placa: ve?.placa || null,
      tipo: manutItem.tipo,
      descricao: manutItem.descricao || null,
      km: Number(manutItem.km) || null,
      valor: Number(manutItem.valor) || 0,
      fornecedor: manutItem.fornecedor || null,
      data: manutItem.data,
      proxima_data: manutItem.proxima_data || null,
      observacao: manutItem.observacao || null,
      created_by: profile?.display_name || '',
    }
    const { error } = await supabase.from('fleet_maintenance').insert(obj)
    if (error) { alert('Erro: ' + error.message); return }
    setManutModal(false); setManutItem(null); load()
  }

  // KPIs viagens
  const totalAberto = viagens.filter(v => v.status === 'aberta').reduce((s, v) => s + (Number(v.valor_frete) || 0), 0)
  const totalFaturado = viagens.filter(v => v.status !== 'aberta').reduce((s, v) => s + (Number(v.valor_frete) || 0), 0)

  const tabs = [
    { k: 'viagens', l: '🚚 Viagens' },
    { k: 'frota', l: '🚛 Frota' },
    { k: 'manutencao', l: '🔧 Manutenção' },
  ] as const

  const stColor = (s: string) => s === 'aberta' ? 'amber' : s === 'faturada' ? 'blue' : 'green'

  return (
    <div style={{ padding: '14px' }}>
      <SH label="🚚 TRANSPORTADORA" action={
        tab === 'viagens' ? <Btn onClick={novaViagem} variant="primary">+ Viagem</Btn>
          : tab === 'manutencao' ? <Btn onClick={novaManut} variant="primary">+ Manutenção</Btn>
            : null
      } />

      {tab === 'viagens' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px', marginBottom: '12px' }}>
          <KPI num={String(viagens.length)} label="Viagens" color="orange" />
          <KPI num={money(totalAberto)} label="A faturar" color="amber" />
          <KPI num={money(totalFaturado)} label="Faturado" color="green" />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {tabs.map(t => <Btn key={t.k} onClick={() => setTab(t.k as any)} variant={tab === t.k ? 'primary' : 'secondary'}>{t.l}</Btn>)}
      </div>

      {loading && <div style={{ color: 'var(--t3)', fontSize: '12px', padding: '20px', textAlign: 'center' }}>Carregando...</div>}

      {/* ─── VIAGENS ─── */}
      {!loading && tab === 'viagens' && (
        viagens.length === 0 ? <Empty icon="🚚" text="Nenhuma viagem registrada" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {viagens.map(v => (
              <div key={v.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <b style={{ color: '#fff', fontSize: '13px' }}>{v.cliente_nome}</b>
                      <Badge color={stColor(v.status)}>{v.status}</Badge>
                    </div>
                    <div style={{ color: 'var(--t3)', fontSize: '11px', marginTop: '2px' }}>
                      {v.origem || '?'} → {v.destino || '?'} · {v.placa || 's/ placa'} · {dBR(v.data_saida)}
                      {v.numero_cte ? ` · CTe ${v.numero_cte}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--t2)' }}>
                    <div>Frete: <b style={{ color: 'var(--gn)' }}>{money(v.valor_frete)}</b></div>
                    <div>Custos: {money(v.total_custos)} · Margem: <b>{money(v.margem)}</b></div>
                  </div>
                  {v.status === 'aberta' && (
                    <Btn onClick={() => { setFatModal(v); setDueDate(new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)) }} variant="primary" size="sm">Faturar</Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
      )}

      {/* ─── FROTA ─── */}
      {!loading && tab === 'frota' && (
        veiculos.length === 0 ? <Empty icon="🚛" text="Nenhum veículo cadastrado (cadastre em Cadastros)" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {veiculos.map(ve => {
              const vencLic = ve.venc_licenciamento && new Date(ve.venc_licenciamento) < new Date()
              return (
                <div key={ve.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <b style={{ color: '#fff', fontSize: '13px' }}>{ve.placa}</b> <span style={{ color: 'var(--t3)', fontSize: '11px' }}>{ve.tipo}</span>
                    <div style={{ color: 'var(--t3)', fontSize: '11px', marginTop: '2px' }}>
                      {ve.motorista_padrao ? `Motorista: ${ve.motorista_padrao}` : 'sem motorista padrão'}
                      {ve.km_atual ? ` · ${Number(ve.km_atual).toLocaleString('pt-BR')} km` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11px' }}>
                    {ve.venc_licenciamento && <div style={{ color: vencLic ? 'var(--rd)' : 'var(--t2)' }}>Licenc.: {dBR(ve.venc_licenciamento)}{vencLic ? ' ⚠️' : ''}</div>}
                    {ve.venc_seguro && <div style={{ color: 'var(--t2)' }}>Seguro: {dBR(ve.venc_seguro)}</div>}
                  </div>
                </div>
              )
            })}
          </div>
      )}

      {/* ─── MANUTENÇÃO ─── */}
      {!loading && tab === 'manutencao' && (
        manut.length === 0 ? <Empty icon="🔧" text="Nenhuma manutenção registrada" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {manut.map(m => (
              <div key={m.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <b style={{ color: '#fff', fontSize: '13px' }}>{m.placa}</b>
                    <Badge color="gray">{m.tipo}</Badge>
                  </div>
                  <div style={{ color: 'var(--t3)', fontSize: '11px', marginTop: '2px' }}>
                    {m.descricao || '—'} · {dBR(m.data)}{m.km ? ` · ${Number(m.km).toLocaleString('pt-BR')} km` : ''}
                    {m.proxima_data ? ` · próx: ${dBR(m.proxima_data)}` : ''}
                  </div>
                </div>
                <b style={{ color: 'var(--rd)', fontSize: '13px' }}>{money(m.valor)}</b>
              </div>
            ))}
          </div>
      )}

      {/* ─── MODAL VIAGEM ─── */}
      <Modal open={viagemModal} onClose={() => setViagemModal(false)} title="Nova viagem"
        footer={<><Btn onClick={() => setViagemModal(false)}>Cancelar</Btn><Btn onClick={salvarViagem} variant="primary">Salvar</Btn></>}>
        <SelectComCadastro label="Cliente *" tipo="cliente" value={viagem?.cliente_id || ''}
          onChange={(v: string) => setViagem({ ...viagem, cliente_id: v })}
          options={clientes.map(c => ({ value: c.id, label: c.nome_razao }))}
          companyId={cid} createdBy={profile?.display_name} onCreatedRefresh={load} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Select label="Veículo" value={viagem?.veiculo_id || ''} onChange={(v: string) => setViagem({ ...viagem, veiculo_id: v })}
            options={[{ value: '', label: '— selecione —' }, ...veiculos.map(ve => ({ value: ve.id, label: `${ve.placa} (${ve.tipo || ''})` }))]} />
          <Input label="Motorista" value={viagem?.motorista || ''} onChange={(v: string) => setViagem({ ...viagem, motorista: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Origem" value={viagem?.origem || ''} onChange={(v: string) => setViagem({ ...viagem, origem: v })} />
          <Input label="Destino" value={viagem?.destino || ''} onChange={(v: string) => setViagem({ ...viagem, destino: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <Input label="CTe" value={viagem?.numero_cte || ''} onChange={(v: string) => setViagem({ ...viagem, numero_cte: v })} />
          <Input label="NF" value={viagem?.numero_nf || ''} onChange={(v: string) => setViagem({ ...viagem, numero_nf: v })} />
          <Input label="Data saída" type="date" value={viagem?.data_saida || ''} onChange={(v: string) => setViagem({ ...viagem, data_saida: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Valor do frete (R$) *" type="number" value={viagem?.valor_frete ?? ''} onChange={(v: string) => setViagem({ ...viagem, valor_frete: v })} />
          <Input label="Pedágio (R$)" type="number" value={viagem?.pedagio ?? ''} onChange={(v: string) => setViagem({ ...viagem, pedagio: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Diárias (R$)" type="number" value={viagem?.diarias ?? ''} onChange={(v: string) => setViagem({ ...viagem, diarias: v })} />
          <Input label="Outras despesas (R$)" type="number" value={viagem?.outras_despesas ?? ''} onChange={(v: string) => setViagem({ ...viagem, outras_despesas: v })} />
        </div>
        <Textarea label="Observação" value={viagem?.observacao || ''} onChange={(v: string) => setViagem({ ...viagem, observacao: v })} rows={2} />
      </Modal>

      {/* ─── MODAL MANUTENÇÃO ─── */}
      <Modal open={manutModal} onClose={() => setManutModal(false)} title="Nova manutenção"
        footer={<><Btn onClick={() => setManutModal(false)}>Cancelar</Btn><Btn onClick={salvarManut} variant="primary">Salvar</Btn></>}>
        <Select label="Veículo *" value={manutItem?.veiculo_id || ''} onChange={(v: string) => setManutItem({ ...manutItem, veiculo_id: v })}
          options={[{ value: '', label: '— selecione —' }, ...veiculos.map(ve => ({ value: ve.id, label: `${ve.placa} (${ve.tipo || ''})` }))]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Select label="Tipo" value={manutItem?.tipo || 'preventiva'} onChange={(v: string) => setManutItem({ ...manutItem, tipo: v })}
            options={['preventiva', 'corretiva', 'troca_oleo', 'pneu', 'freios', 'revisao', 'outros']} />
          <Input label="KM" type="number" value={manutItem?.km ?? ''} onChange={(v: string) => setManutItem({ ...manutItem, km: v })} />
        </div>
        <Input label="Descrição" value={manutItem?.descricao || ''} onChange={(v: string) => setManutItem({ ...manutItem, descricao: v })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Valor (R$)" type="number" value={manutItem?.valor ?? ''} onChange={(v: string) => setManutItem({ ...manutItem, valor: v })} />
          <Input label="Fornecedor" value={manutItem?.fornecedor || ''} onChange={(v: string) => setManutItem({ ...manutItem, fornecedor: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Data" type="date" value={manutItem?.data || ''} onChange={(v: string) => setManutItem({ ...manutItem, data: v })} />
          <Input label="Próxima revisão" type="date" value={manutItem?.proxima_data || ''} onChange={(v: string) => setManutItem({ ...manutItem, proxima_data: v })} />
        </div>
        <Textarea label="Observação" value={manutItem?.observacao || ''} onChange={(v: string) => setManutItem({ ...manutItem, observacao: v })} rows={2} />
      </Modal>

      {/* ─── MODAL FATURAR ─── */}
      <Modal open={!!fatModal} onClose={() => setFatModal(null)} title="Faturar viagem"
        footer={<><Btn onClick={() => setFatModal(null)}>Cancelar</Btn><Btn onClick={faturarViagem} variant="primary">Faturar</Btn></>}>
        {fatModal && (
          <div style={{ fontSize: '12px', color: 'var(--t2)', marginBottom: '10px' }}>
            Cliente: <b style={{ color: '#fff' }}>{fatModal.cliente_nome}</b><br />
            Valor do frete: <b style={{ color: 'var(--gn)' }}>{money(fatModal.valor_frete)}</b>
            <div style={{ color: 'var(--t3)', fontSize: '10px', marginTop: '6px' }}>Será lançado em Contas a Receber com o vencimento abaixo.</div>
          </div>
        )}
        <Input label="Vencimento" type="date" value={dueDate} onChange={setDueDate} />
      </Modal>

      {dialog}
    </div>
  )
}
