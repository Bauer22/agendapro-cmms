'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, Empty } from '@/components/ui'

type Props = { profile?: any; can?: any }
type Item = { product_id: string; product_nome: string; barcode: string; quantidade: number; preco_unitario: number }

const money = (v: any) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PDVPage({ profile }: Props) {
  const cid = profile?.company_id || null
  const [produtos, setProdutos] = useState<any[]>([])
  const [carrinho, setCarrinho] = useState<Item[]>([])
  const [codigo, setCodigo] = useState('')
  const [busca, setBusca] = useState('')
  const [pagModal, setPagModal] = useState(false)
  const [forma, setForma] = useState('dinheiro')
  const [valorPago, setValorPago] = useState('')
  const [desconto, setDesconto] = useState('')
  const [cliente, setCliente] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ultima, setUltima] = useState<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadProdutos() {
    const { data } = await supabase.from('products').select('id,name,barcode,sku,preco_venda,saldo,unit').eq('active', true).order('name')
    setProdutos(data || [])
  }
  useEffect(() => { loadProdutos(); inputRef.current?.focus() }, [])

  function addProduto(p: any) {
    if (!p) return
    setCarrinho(prev => {
      const i = prev.findIndex(x => x.product_id === p.id)
      if (i >= 0) {
        const c = [...prev]; c[i] = { ...c[i], quantidade: c[i].quantidade + 1 }; return c
      }
      return [...prev, { product_id: p.id, product_nome: p.name, barcode: p.barcode || '', quantidade: 1, preco_unitario: Number(p.preco_venda) || 0 }]
    })
  }

  // leitura por código de barras (enter)
  function onCodigoEnter(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    const cod = codigo.trim()
    if (!cod) return
    const p = produtos.find(x => (x.barcode || '') === cod || (x.sku || '') === cod)
    if (p) { addProduto(p); setCodigo('') }
    else { alert('Produto não encontrado para o código: ' + cod); setCodigo('') }
    inputRef.current?.focus()
  }

  function mudarQtd(id: string, delta: number) {
    setCarrinho(prev => prev.map(x => x.product_id === id ? { ...x, quantidade: Math.max(1, x.quantidade + delta) } : x))
  }
  function setQtd(id: string, q: number) {
    setCarrinho(prev => prev.map(x => x.product_id === id ? { ...x, quantidade: Math.max(1, q || 1) } : x))
  }
  function remover(id: string) { setCarrinho(prev => prev.filter(x => x.product_id !== id)) }
  function limpar() { setCarrinho([]); setDesconto(''); setCliente('') }

  const subtotal = carrinho.reduce((s, x) => s + x.quantidade * x.preco_unitario, 0)
  const desc = Number(desconto) || 0
  const total = Math.max(0, subtotal - desc)
  const troco = Math.max(0, (Number(valorPago) || 0) - total)

  async function finalizar() {
    if (carrinho.length === 0) return
    setSalvando(true)
    try {
      const { data, error } = await supabase.rpc('finalizar_venda_pdv', {
        p_company: cid,
        p_itens: carrinho,
        p_desconto: desc,
        p_forma: forma,
        p_valor_pago: Number(valorPago) || total,
        p_cliente: cliente || null,
        p_user: profile?.display_name || '',
      })
      if (error) { alert('Erro ao finalizar venda: ' + error.message); return }
      setUltima({ total, troco, forma, n: carrinho.length })
      setPagModal(false); limpar(); setValorPago(''); loadProdutos()
      inputRef.current?.focus()
    } finally { setSalvando(false) }
  }

  const prodBusca = busca
    ? produtos.filter(p => (p.name || '').toLowerCase().includes(busca.toLowerCase()) || (p.barcode || '').includes(busca) || (p.sku || '').toLowerCase().includes(busca.toLowerCase())).slice(0, 12)
    : []

  return (
    <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(260px,1fr)', gap: '14px', alignItems: 'start' }}>
      {/* ─── COLUNA ESQUERDA: leitura + busca ─── */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--cy)', textTransform: 'uppercase', marginBottom: '10px' }}>🧾 FRENTE DE CAIXA (PDV)</div>

        <input
          ref={inputRef}
          placeholder="📷 Passe o código de barras e tecle Enter..."
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          onKeyDown={onCodigoEnter}
          style={{ width: '100%', background: '#0f1f3d', border: '2px solid var(--cy)', borderRadius: '12px', padding: '14px 16px', color: '#fff', fontSize: '15px', outline: 'none', marginBottom: '12px', fontWeight: 600 }}
        />

        <input
          placeholder="🔍 ou busque por nome / SKU..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ width: '100%', background: '#16284a', border: '1px solid var(--bd)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '12px', outline: 'none', marginBottom: '10px' }}
        />
        {prodBusca.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {prodBusca.map(p => (
              <button key={p.id} onClick={() => { addProduto(p); setBusca('') }}
                style={{ textAlign: 'left', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '10px 12px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>{p.name} <span style={{ color: 'var(--t3)' }}>{p.barcode || ''}</span></span>
                <b style={{ color: 'var(--gn)' }}>{money(p.preco_venda)}</b>
              </button>
            ))}
          </div>
        )}

        {ultima && (
          <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: 'var(--gn)' }}>
            ✅ Venda concluída · {ultima.n} item(ns) · {money(ultima.total)} · {ultima.forma}{ultima.troco > 0 ? ` · troco ${money(ultima.troco)}` : ''}
          </div>
        )}
      </div>

      {/* ─── COLUNA DIREITA: carrinho ─── */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: '14px', padding: '14px', position: 'sticky', top: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <b style={{ color: '#fff', fontSize: '13px' }}>🛒 Carrinho</b>
          {carrinho.length > 0 && <Btn onClick={limpar} size="sm" variant="danger">Limpar</Btn>}
        </div>

        {carrinho.length === 0
          ? <Empty icon="🛒" text="Carrinho vazio" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '48vh', overflowY: 'auto' }}>
            {carrinho.map(x => (
              <div key={x.product_id} style={{ borderBottom: '1px solid var(--bd)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#fff', fontSize: '12px', flex: 1 }}>{x.product_nome}</span>
                  <button onClick={() => remover(x.product_id)} style={{ background: 'none', border: 'none', color: 'var(--rd)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => mudarQtd(x.product_id, -1)} style={qtdBtn}>−</button>
                    <input value={x.quantidade} onChange={e => setQtd(x.product_id, parseInt(e.target.value))}
                      style={{ width: '42px', textAlign: 'center', background: '#16284a', border: '1px solid var(--bd)', borderRadius: '8px', color: '#fff', padding: '4px', fontSize: '12px' }} />
                    <button onClick={() => mudarQtd(x.product_id, 1)} style={qtdBtn}>+</button>
                  </div>
                  <b style={{ color: 'var(--gn)', fontSize: '12px' }}>{money(x.quantidade * x.preco_unitario)}</b>
                </div>
              </div>
            ))}
          </div>}

        <div style={{ marginTop: '12px', borderTop: '2px solid var(--bd)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--t2)' }}>
            <span>Subtotal</span><span>{money(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--t2)', margin: '6px 0' }}>
            <span>Desconto</span>
            <input value={desconto} onChange={e => setDesconto(e.target.value)} type="number" placeholder="0,00"
              style={{ width: '90px', textAlign: 'right', background: '#16284a', border: '1px solid var(--bd)', borderRadius: '8px', color: '#fff', padding: '5px 8px', fontSize: '12px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, color: '#fff', margin: '8px 0' }}>
            <span>TOTAL</span><span style={{ color: 'var(--cy)' }}>{money(total)}</span>
          </div>
          <Btn onClick={() => { setValorPago(String(total)); setPagModal(true) }} variant="primary" size="md"
            className="w-full" disabled={carrinho.length === 0}>
            <span style={{ display: 'block', textAlign: 'center', width: '100%' }}>💵 Finalizar venda</span>
          </Btn>
        </div>
      </div>

      {/* ─── MODAL PAGAMENTO ─── */}
      <Modal open={pagModal} onClose={() => setPagModal(false)} title="Pagamento"
        footer={<><Btn onClick={() => setPagModal(false)}>Voltar</Btn><Btn onClick={finalizar} variant="primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Confirmar'}</Btn></>}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--cy)', textAlign: 'center', marginBottom: '12px' }}>{money(total)}</div>
        <Select label="Forma de pagamento" value={forma} onChange={setForma}
          options={[
            { value: 'dinheiro', label: 'Dinheiro' },
            { value: 'pix', label: 'PIX' },
            { value: 'cartao_debito', label: 'Cartão débito' },
            { value: 'cartao_credito', label: 'Cartão crédito' },
          ]} />
        {forma === 'dinheiro' && (
          <>
            <Input label="Valor pago (R$)" type="number" value={valorPago} onChange={setValorPago} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--gn)', fontWeight: 700, padding: '6px 0' }}>
              <span>Troco</span><span>{money(troco)}</span>
            </div>
          </>
        )}
        <Input label="Cliente (opcional)" value={cliente} onChange={setCliente} placeholder="Venda balcão" />
      </Modal>
    </div>
  )
}

const qtdBtn: React.CSSProperties = { width: '26px', height: '26px', borderRadius: '8px', background: '#16284a', border: '1px solid var(--bd)', color: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }
