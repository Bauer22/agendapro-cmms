'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SelectComCadastro, Textarea, SH, Empty, Badge, KPI, useConfirm } from '@/components/ui'
import PartsPage from '@/app/pages/PartsPage'

type Props = { profile?: any; can?: any }

const money = (v: any) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qtd = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function EstoquePage({ profile, can }: Props) {
  const { confirm, dialog } = useConfirm()
  const [tab, setTab] = useState<'produtos' | 'compras' | 'movimentos' | 'pecas'>('produtos')
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')

  const [produtos, setProdutos] = useState<any[]>([])
  const [compras, setCompras] = useState<any[]>([])
  const [movs, setMovs] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])

  // modais
  const [prodModal, setProdModal] = useState(false)
  const [editProd, setEditProd] = useState<any>(null)
  const [compraModal, setCompraModal] = useState(false)
  const [compra, setCompra] = useState<any>(null)

  const cid = profile?.company_id || null

  async function load() {
    setLoading(true)
    try {
      if (tab === 'produtos') {
        const { data } = await supabase.from('products').select('*').order('name')
        setProdutos(data || [])
      } else if (tab === 'compras') {
        const [c, f] = await Promise.all([
          supabase.from('product_purchases').select('*').order('data_compra', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('cadastros').select('id,nome_razao').eq('is_fornecedor', true).eq('status', true).order('nome_razao'),
        ])
        setCompras(c.data || [])
        setFornecedores(f.data || [])
        const { data: pd } = await supabase.from('products').select('id,name,barcode,unit,custo_medio').order('name')
        setProdutos(pd || [])
      } else {
        const { data } = await supabase.from('product_stock_movements').select('*').order('created_at', { ascending: false }).limit(300)
        setMovs(data || [])
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tab])

  // ─── PRODUTO ───────────────────────────────────────────────
  function novoProduto() {
    setEditProd({ name: '', barcode: '', sku: '', categoria: '', unit: 'un', preco_venda: '', estoque_minimo: '', active: true })
    setProdModal(true)
  }
  function abrirProduto(p: any) { setEditProd({ ...p }); setProdModal(true) }

  async function salvarProduto() {
    if (!editProd?.name) { alert('Informe o nome do produto'); return }
    const obj: any = {
      name: editProd.name,
      barcode: editProd.barcode || null,
      sku: editProd.sku || null,
      categoria: editProd.categoria || null,
      unit: editProd.unit || 'un',
      preco_venda: Number(editProd.preco_venda) || 0,
      estoque_minimo: Number(editProd.estoque_minimo) || 0,
      active: editProd.active !== false,
      company_id: cid,
    }
    const res = editProd.id
      ? await supabase.from('products').update(obj).eq('id', editProd.id)
      : await supabase.from('products').insert({ ...obj, saldo: 0, custo_medio: 0 })
    if (res.error) { alert('Erro ao salvar: ' + res.error.message); return }
    setProdModal(false); setEditProd(null); load()
  }

  async function excluirProduto(p: any) {
    if (!(await confirm(`Excluir o produto "${p.name}"?`))) return
    const { error } = await supabase.from('products').update({ active: false }).eq('id', p.id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  // ─── COMPRA (entrada que recalcula custo médio) ────────────
  function novaCompra() {
    setCompra({ product_id: '', fornecedor_id: '', numero_nf: '', quantidade: '', custo_unitario: '', data_compra: new Date().toISOString().slice(0, 10), observacao: '' })
    setCompraModal(true)
  }

  async function salvarCompra() {
    if (!compra?.product_id) { alert('Selecione o produto'); return }
    const q = Number(compra.quantidade) || 0
    const cu = Number(compra.custo_unitario) || 0
    if (q <= 0) { alert('Quantidade deve ser maior que zero'); return }

    const prod = produtos.find(p => p.id === compra.product_id)
    const forn = fornecedores.find(f => f.id === compra.fornecedor_id)

    // 1. registra a compra
    const { data: comp, error: e1 } = await supabase.from('product_purchases').insert({
      company_id: cid,
      product_id: compra.product_id,
      product_nome: prod?.name || '',
      fornecedor_id: compra.fornecedor_id || null,
      fornecedor_nome: forn?.nome_razao || null,
      numero_nf: compra.numero_nf || null,
      quantidade: q,
      custo_unitario: cu,
      valor_total: q * cu,
      data_compra: compra.data_compra,
      observacao: compra.observacao || null,
      created_by: profile?.display_name || '',
    }).select().single()
    if (e1) { alert('Erro ao registrar compra: ' + e1.message); return }

    // 2. aplica no estoque + recalcula custo médio (função no banco)
    const { error: e2 } = await supabase.rpc('aplicar_compra_produto', {
      p_product_id: compra.product_id,
      p_qtd: q,
      p_custo_unit: cu,
      p_company: cid,
      p_ref: comp?.id || null,
      p_user: profile?.display_name || '',
    })
    if (e2) { alert('Compra registrada, mas falhou ao atualizar estoque: ' + e2.message); return }

    setCompraModal(false); setCompra(null); load()
  }

  // ─── filtros ───────────────────────────────────────────────
  const prodFiltrados = produtos.filter(p => {
    if (!busca) return true
    const t = busca.toLowerCase()
    return (p.name || '').toLowerCase().includes(t) || (p.barcode || '').includes(t) || (p.sku || '').toLowerCase().includes(t)
  })

  const valorTotalEstoque = produtos.reduce((s, p) => s + (Number(p.saldo) || 0) * (Number(p.custo_medio) || 0), 0)
  const itensAbaixoMin = produtos.filter(p => (Number(p.saldo) || 0) <= (Number(p.estoque_minimo) || 0) && p.active !== false).length

  const tabs = [
    { k: 'produtos', l: '📦 Produtos' },
    { k: 'compras', l: '🛒 Compras' },
    { k: 'movimentos', l: '📊 Movimentos' },
    { k: 'pecas', l: '🔧 Peças' },
  ] as const

  return (
    <div style={{ padding: '14px' }}>
      <SH label="📦 ESTOQUE DE PRODUTOS" action={
        tab === 'produtos'
          ? <Btn onClick={novoProduto} variant="primary">+ Produto</Btn>
          : tab === 'compras'
            ? <Btn onClick={novaCompra} variant="primary">+ Compra</Btn>
            : null
      } />

      {/* KPIs */}
      {tab === 'produtos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px', marginBottom: '12px' }}>
          <KPI num={String(produtos.filter(p => p.active !== false).length)} label="Produtos ativos" color="orange" />
          <KPI num={money(valorTotalEstoque)} label="Valor em estoque" color="green" />
          <KPI num={String(itensAbaixoMin)} label="Abaixo do mínimo" color={itensAbaixoMin > 0 ? 'red' : 'green'} />
        </div>
      )}

      {/* abas */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <Btn key={t.k} onClick={() => setTab(t.k as any)} variant={tab === t.k ? 'primary' : 'secondary'}>{t.l}</Btn>
        ))}
      </div>

      {(tab === 'produtos') && (
        <input
          placeholder="🔍 Buscar por nome, código de barras ou SKU..."
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ width: '100%', background: '#16284a', border: '1px solid var(--bd)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '12px', marginBottom: '12px', outline: 'none' }}
        />
      )}

      {loading && tab !== 'pecas' && <div style={{ color: 'var(--t3)', fontSize: '12px', padding: '20px', textAlign: 'center' }}>Carregando...</div>}

      {/* ─── PRODUTOS ─── */}
      {!loading && tab === 'produtos' && (
        prodFiltrados.length === 0
          ? <Empty icon="📦" text="Nenhum produto cadastrado" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {prodFiltrados.map(p => {
              const abaixo = (Number(p.saldo) || 0) <= (Number(p.estoque_minimo) || 0)
              return (
                <div key={p.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', opacity: p.active === false ? 0.5 : 1 }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <b style={{ color: '#fff', fontSize: '13px' }}>{p.name}</b>
                      {p.categoria && <Badge color="gray">{p.categoria}</Badge>}
                      {abaixo && p.active !== false && <Badge color="red">estoque baixo</Badge>}
                    </div>
                    <div style={{ color: 'var(--t3)', fontSize: '11px', marginTop: '2px' }}>
                      {p.barcode ? `📷 ${p.barcode}` : 'sem código'} {p.sku ? ` · SKU ${p.sku}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--t2)' }}>
                    <div>Saldo: <b style={{ color: abaixo ? 'var(--rd)' : '#fff' }}>{qtd(p.saldo)} {p.unit || 'un'}</b></div>
                    <div>Custo médio: {money(p.custo_medio)}</div>
                    <div>Venda: <b style={{ color: 'var(--gn)' }}>{money(p.preco_venda)}</b></div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Btn onClick={() => abrirProduto(p)} size="sm">✏️</Btn>
                    <Btn onClick={() => excluirProduto(p)} size="sm" variant="danger">🗑️</Btn>
                  </div>
                </div>
              )
            })}
          </div>
      )}

      {/* ─── COMPRAS ─── */}
      {!loading && tab === 'compras' && (
        compras.length === 0
          ? <Empty icon="🛒" text="Nenhuma compra registrada" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {compras.map(c => (
              <div key={c.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <b style={{ color: '#fff', fontSize: '13px' }}>{c.product_nome}</b>
                  <div style={{ color: 'var(--t3)', fontSize: '11px', marginTop: '2px' }}>
                    {c.fornecedor_nome || 'sem fornecedor'} {c.numero_nf ? ` · NF ${c.numero_nf}` : ''} · {c.data_compra?.split('-').reverse().join('/')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--t2)' }}>
                  <div>{qtd(c.quantidade)} × {money(c.custo_unitario)}</div>
                  <div><b style={{ color: 'var(--gn)' }}>{money(c.valor_total)}</b></div>
                </div>
              </div>
            ))}
          </div>
      )}

      {/* ─── MOVIMENTOS ─── */}
      {!loading && tab === 'movimentos' && (
        movs.length === 0
          ? <Empty icon="📊" text="Nenhuma movimentação" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {movs.map(m => (
              <div key={m.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <b style={{ color: '#fff', fontSize: '12px' }}>{m.product_nome}</b>
                  <div style={{ color: 'var(--t3)', fontSize: '10px' }}>{m.origem} · {m.created_at?.slice(0, 10).split('-').reverse().join('/')}</div>
                </div>
                <Badge color={m.tipo === 'entrada' ? 'green' : m.tipo === 'saida' ? 'red' : 'gray'}>
                  {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : '='} {qtd(m.quantidade)}
                </Badge>
                <div style={{ fontSize: '11px', color: 'var(--t2)' }}>saldo: {qtd(m.saldo_apos)}</div>
              </div>
            ))}
          </div>
      )}

      {/* ─── PEÇAS (estoque de manutenção — página separada embutida) ─── */}
      {tab === 'pecas' && (
        <div style={{ marginTop: '-4px' }}>
          <PartsPage profile={profile} can={can} />
        </div>
      )}

      {/* ─── MODAL PRODUTO ─── */}
      <Modal open={prodModal} onClose={() => setProdModal(false)} title={editProd?.id ? 'Editar produto' : 'Novo produto'}
        footer={<><Btn onClick={() => setProdModal(false)}>Cancelar</Btn><Btn onClick={salvarProduto} variant="primary">Salvar</Btn></>}>
        <Input label="Nome do produto *" value={editProd?.name || ''} onChange={(v: string) => setEditProd({ ...editProd, name: v })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Código de barras" value={editProd?.barcode || ''} onChange={(v: string) => setEditProd({ ...editProd, barcode: v })} placeholder="EAN / leitura" />
          <Input label="SKU (código interno)" value={editProd?.sku || ''} onChange={(v: string) => setEditProd({ ...editProd, sku: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Categoria" value={editProd?.categoria || ''} onChange={(v: string) => setEditProd({ ...editProd, categoria: v })} />
          <Select label="Unidade" value={editProd?.unit || 'un'} onChange={(v: string) => setEditProd({ ...editProd, unit: v })}
            options={['un', 'kg', 'g', 'lt', 'ml', 'cx', 'pct', 'm', 'm²', 'm³']} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Preço de venda (R$)" type="number" value={editProd?.preco_venda ?? ''} onChange={(v: string) => setEditProd({ ...editProd, preco_venda: v })} />
          <Input label="Estoque mínimo" type="number" value={editProd?.estoque_minimo ?? ''} onChange={(v: string) => setEditProd({ ...editProd, estoque_minimo: v })} />
        </div>
        {editProd?.id && (
          <div style={{ background: 'rgba(249,115,22,.08)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '10px', fontSize: '11px', color: 'var(--t2)', marginTop: '6px' }}>
            Saldo atual: <b>{qtd(editProd.saldo)} {editProd.unit}</b> · Custo médio: <b>{money(editProd.custo_medio)}</b><br />
            <span style={{ color: 'var(--t3)' }}>Saldo e custo médio só mudam por compras e vendas (não são editados aqui).</span>
          </div>
        )}
      </Modal>

      {/* ─── MODAL COMPRA ─── */}
      <Modal open={compraModal} onClose={() => setCompraModal(false)} title="Registrar compra (entrada de estoque)"
        footer={<><Btn onClick={() => setCompraModal(false)}>Cancelar</Btn><Btn onClick={salvarCompra} variant="primary">Registrar</Btn></>}>
        <SelectComCadastro label="Produto *" tipo="produto" value={compra?.product_id || ''}
          onChange={(v: string) => setCompra({ ...compra, product_id: v })}
          options={produtos.map(p => ({ value: p.id, label: `${p.name}${p.barcode ? ' · ' + p.barcode : ''}` }))}
          companyId={cid} createdBy={profile?.display_name} onCreatedRefresh={load} />
        <SelectComCadastro label="Fornecedor" tipo="fornecedor" value={compra?.fornecedor_id || ''}
          onChange={(v: string) => setCompra({ ...compra, fornecedor_id: v })}
          options={fornecedores.map(f => ({ value: f.id, label: f.nome_razao }))}
          companyId={cid} createdBy={profile?.display_name} onCreatedRefresh={load} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Nº da NF" value={compra?.numero_nf || ''} onChange={(v: string) => setCompra({ ...compra, numero_nf: v })} />
          <Input label="Data da compra" type="date" value={compra?.data_compra || ''} onChange={(v: string) => setCompra({ ...compra, data_compra: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Quantidade *" type="number" value={compra?.quantidade ?? ''} onChange={(v: string) => setCompra({ ...compra, quantidade: v })} />
          <Input label="Custo unitário (R$) *" type="number" value={compra?.custo_unitario ?? ''} onChange={(v: string) => setCompra({ ...compra, custo_unitario: v })} />
        </div>
        <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '10px', fontSize: '12px', color: 'var(--t2)' }}>
          Total da compra: <b style={{ color: 'var(--gn)' }}>{money((Number(compra?.quantidade) || 0) * (Number(compra?.custo_unitario) || 0))}</b>
          <div style={{ color: 'var(--t3)', fontSize: '10px', marginTop: '4px' }}>Ao registrar, o estoque aumenta e o custo médio do produto é recalculado automaticamente.</div>
        </div>
        <Textarea label="Observação" value={compra?.observacao || ''} onChange={(v: string) => setCompra({ ...compra, observacao: v })} rows={2} />
      </Modal>

      {dialog}
    </div>
  )
}
