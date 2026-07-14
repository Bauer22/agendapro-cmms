'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

function maskPlate(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7)
}

const STATUS_C: Record<string,string> = { active:'green', cancelled:'red' }

export default function SalesPage({ profile, can }: Props) {
  const [orders, setOrders]     = useState<any[]>([])
  const [clients, setClients]   = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [modal, setModal]       = useState(false)
  const [clientModal, setClientModal] = useState(false)
  const [productModal, setProductModal] = useState(false)
  const [view, setView]         = useState<any>(null)
  const [editing, setEditing]   = useState<any>({})
  const [newClient, setNewClient] = useState<any>({})
  const [newProduct, setNewProduct] = useState<any>({})
  const [tab, setTab]           = useState<'open'|'all'>('open')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { load(); loadMeta() }, [tab])

  async function load() {
    let q = supabase.from('sales_orders').select('*').order('created_at', { ascending: false })
    if (tab === 'open') q = q.eq('status', 'active')
    const { data, error } = await q
    if (error) toast.error('Erro: ' + error.message)
    setOrders(data || [])
    setLoading(false)
  }

  async function loadMeta() {
    const [c, p] = await Promise.all([
      supabase.from('clients').select('id,name').eq('active', true).order('name'),
      supabase.from('products').select('id,name,unit').eq('active', true).order('name'),
    ])
    setClients(c.data || [])
    setProducts(p.data || [])
  }

  function openNew() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2,'0')
    const mm = String(now.getMinutes()).padStart(2,'0')
    setEditing({
      sale_date: td(),
      exit_time: `${hh}:${mm}`,
      status: 'active',
    })
    setModal(true)
  }

  async function save() {
    if (!editing.client_id)     { toast.error('Selecione o cliente'); return }
    if (!editing.product_id)    { toast.error('Selecione o produto'); return }
    if (!editing.driver?.trim()) { toast.error('Informe o motorista'); return }
    if (!editing.plate?.trim()) { toast.error('Informe a placa'); return }
    const hasQty = (editing.weight_tons && parseFloat(editing.weight_tons) > 0) ||
                   (editing.volume_m3 && parseFloat(editing.volume_m3) > 0)
    if (!hasQty) { toast.error('Informe ao menos Toneladas ou Metros'); return }

    setSaving(true)

    const cli = clients.find(c => c.id === editing.client_id)
    const prd = products.find(p => p.id === editing.product_id)
    const obj = {
      sale_date:    editing.sale_date || td(),
      exit_time:    editing.exit_time,
      client_id:    editing.client_id,
      client_name:  cli?.name || '',
      product_id:   editing.product_id,
      product_name: prd?.name || '',
      weight_tons:  editing.weight_tons ? parseFloat(editing.weight_tons) : null,
      volume_m3:    editing.volume_m3 ? parseFloat(editing.volume_m3) : null,
      plate:        editing.plate.trim().toUpperCase(),
      driver:       editing.driver.trim(),
      status:       editing.status || 'active',
      notes:        editing.notes || null,
      created_by:   profile?.display_name || '',
      created_by_id: profile?.id || null,
    }

    const { error } = editing.id
      ? await supabase.from('sales_orders').update({ ...obj, updated_by: profile?.display_name, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('sales_orders').insert(obj)

    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }

    // Audit trail
    await supabase.from('audit_trail').insert({
      table_name: 'sales_orders',
      record_id: editing.id || null,
      action: editing.id ? 'UPDATE' : 'INSERT',
      new_data: obj,
      user_id: profile?.id,
      user_name: profile?.display_name,
    }).then(() => {})

    toast.success(editing.id ? 'Romaneio atualizado ✅' : 'Romaneio gerado ✅')
    setSaving(false)
    setModal(false)
    load()
  }

  async function saveClient() {
    if (!newClient.name) { toast.error('Informe o nome do cliente'); return }
    const { error } = await supabase.from('clients').insert({ ...newClient, active: true })
    if (error) { toast.error(error.message); return }
    toast.success('Cliente cadastrado ✅')
    setClientModal(false); setNewClient({})
    loadMeta()
  }

  async function saveProduct() {
    if (!newProduct.name) { toast.error('Informe o nome do produto'); return }
    const { error } = await supabase.from('products').insert({ ...newProduct, active: true, unit: newProduct.unit || 'ton' })
    if (error) { toast.error(error.message); return }
    toast.success('Produto cadastrado ✅')
    setProductModal(false); setNewProduct({})
    loadMeta()
  }

  async function cancel(id: string) {
    if (!await confirm('Cancelar este romaneio?')) return
    const { error } = await supabase.from('sales_orders').update({ status: 'cancelled', updated_by: profile?.display_name, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Romaneio cancelado'); load()
  }

  const totalTons = orders.filter(o => o.status === 'active').reduce((s,o) => s + (parseFloat(o.weight_tons)||0), 0)
  const todayCount = orders.filter(o => o.sale_date === td() && o.status === 'active').length

  return (
    <div className="page-enter p-3">
      {dialog}

      <SH label="🛒 Vendas / Romaneio" action={
        <div className="flex gap-1">
          <Btn onClick={() => setClientModal(true)} variant="secondary" size="sm">+ Cliente</Btn>
          <Btn onClick={() => setProductModal(true)} variant="secondary" size="sm">+ Produto</Btn>
          <Btn onClick={openNew} variant="primary" size="sm">+ Romaneio</Btn>
        </div>
      } />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <KPI num={`${totalTons.toFixed(1)} t`} label="Toneladas saídas" color="orange" />
        <KPI num={todayCount} label="Romaneios hoje" color="blue" />
      </div>

      <div className="flex gap-2 mb-3">
        {(['open','all'] as const).map(t => (
          <div key={t} onClick={() => { setTab(t); setLoading(true) }}
            style={{ flex:1, textAlign:'center', padding:'7px', borderRadius:'10px', fontSize:'11px', fontWeight:700, cursor:'pointer',
              background: tab===t ? 'rgba(249,115,22,.12)' : 'var(--s1)',
              border: `1px solid ${tab===t ? 'rgba(249,115,22,.4)' : 'var(--bd)'}`,
              color: tab===t ? '#f97316' : 'var(--t2)' }}>
            {t === 'open' ? '📋 Ativos' : '📦 Todos'}
          </div>
        ))}
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> :
       orders.length === 0 ? <Empty icon="🛒" text="Nenhum romaneio encontrado." /> : (
        <div className="flex flex-col gap-2">
          {orders.map(o => (
            <div key={o.id} onClick={() => setView(o)}
              className="rounded-xl p-3 cursor-pointer"
              style={{ background:'var(--s1)', border:`1px solid ${o.status==='cancelled'?'rgba(239,68,68,.3)':'var(--bd)'}` }}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold" style={{ color:'var(--cy)', fontSize:'13px' }}>
                      Nº {o.romaneio_num}
                    </span>
                    <Badge color={STATUS_C[o.status]||'gray'}>
                      {o.status === 'active' ? '✅ Ativo' : '❌ Cancelado'}
                    </Badge>
                  </div>
                  <div className="font-bold text-sm">{o.client_name}</div>
                  <div className="text-xs mt-0.5" style={{ color:'var(--t2)' }}>
                    {o.product_name} · {o.weight_tons ? `${parseFloat(o.weight_tons).toFixed(3)} t` : ''}{o.volume_m3 ? ` · ${parseFloat(o.volume_m3).toFixed(2)} m³` : ''}
                  </div>
                  <div className="text-xs" style={{ color:'var(--t3)' }}>
                    📅 {fmtD(o.sale_date)}{o.exit_time ? ' às ' + o.exit_time.slice(0,5) : ''}
                    {o.driver ? ' · 🚗 ' + o.driver : ''}
                    {o.plate ? ' · 🚛 ' + o.plate : ''}
                  </div>
                </div>
                <div className="flex gap-1 ml-2" onClick={ev => ev.stopPropagation()}>
                  {o.status === 'active' && <>
                    <Btn onClick={() => { setEditing(o); setModal(true) }} size="sm">✏️</Btn>
                    <Btn onClick={() => cancel(o.id)} variant="danger" size="sm">✕</Btn>
                  </>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detalhe */}
      <Modal open={!!view} onClose={() => setView(null)} title={`Romaneio Nº ${view?.romaneio_num || ''}`}>
        {view && (
          <div className="flex flex-col gap-1">
            {[
              ['Nº Romaneio', String(view.romaneio_num)],
              ['Data', fmtD(view.sale_date)],
              ['Hora Saída', view.exit_time?.slice(0,5) || '—'],
              ['Cliente', view.client_name || '—'],
              ['Produto', view.product_name || '—'],
              ['Toneladas', view.weight_tons ? `${parseFloat(view.weight_tons).toFixed(3)} t` : '—'],
              ['Metros (m³)', view.volume_m3 ? `${parseFloat(view.volume_m3).toFixed(2)} m³` : '—'],
              ['Motorista', view.driver || '—'],
              ['Placa', view.plate || '—'],
              ['Observações', view.notes || '—'],
              ['Registrado por', view.created_by || '—'],
              ['Status', view.status === 'active' ? '✅ Ativo' : '❌ Cancelado'],
            ].map(([l,v],i) => (
              <div key={i} className="flex justify-between py-1.5 border-b" style={{ borderColor:'var(--bd)', fontSize:'12px' }}>
                <span style={{ color:'var(--t3)' }}>{l}</span>
                <span style={{ fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Novo Romaneio */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing.id ? `Editar Romaneio Nº ${editing.romaneio_num}` : 'Novo Romaneio'}
        footer={
          <>
            <Btn onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save} variant="primary" size="md" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Btn>
          </>
        }>

        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data *" value={editing.sale_date} onChange={(v:string) => setEditing((e:any) => ({...e, sale_date:v}))} type="date" />
          <Input label="Hora Saída *" value={editing.exit_time} onChange={(v:string) => setEditing((e:any) => ({...e, exit_time:v}))} type="time" />
        </div>

        <Select label="Cliente *" value={editing.client_id||''} onChange={(v:string) => setEditing((e:any) => ({...e, client_id:v}))}
          options={[{value:'',label:'Selecione o cliente...'}, ...clients.map(c => ({value:c.id, label:c.name}))]} />

        <Select label="Produto *" value={editing.product_id||''} onChange={(v:string) => setEditing((e:any) => ({...e, product_id:v}))}
          options={[{value:'',label:'Selecione o produto...'}, ...products.map(p => ({value:p.id, label:p.name}))]} />

        <div style={{fontSize:'9px',fontWeight:700,color:'rgba(249,115,22,.65)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px',marginTop:'4px'}}>
          ⚠️ Preencha ao menos Toneladas ou Metros
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Toneladas" value={editing.weight_tons} onChange={(v:string) => setEditing((e:any) => ({...e, weight_tons:v}))} type="number" placeholder="0.000" />
          <Input label="Metros (m³/ster)" value={editing.volume_m3} onChange={(v:string) => setEditing((e:any) => ({...e, volume_m3:v}))} type="number" placeholder="0.00" />
        </div>

        <Input label="Motorista *" value={editing.driver} onChange={(v:string) => setEditing((e:any) => ({...e, driver:v}))} placeholder="Nome completo" />
        <Input label="Placa *" value={editing.plate} onChange={(v:string) => setEditing((e:any) => ({...e, plate:maskPlate(v)}))} placeholder="AAA0A00 ou AAA0000" />
        <Textarea label="Observações" value={editing.notes} onChange={(v:string) => setEditing((e:any) => ({...e, notes:v}))} rows={2} placeholder="Opcional..." />
      </Modal>

      {/* Cadastro rápido de cliente */}
      <Modal open={clientModal} onClose={() => setClientModal(false)} title="Novo Cliente"
        footer={<><Btn onClick={() => setClientModal(false)}>Cancelar</Btn><Btn onClick={saveClient} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Nome *" value={newClient.name} onChange={(v:string) => setNewClient((e:any) => ({...e, name:v}))} placeholder="Nome do cliente" />
        <Input label="CPF / CNPJ" value={newClient.document} onChange={(v:string) => setNewClient((e:any) => ({...e, document:v}))} placeholder="000.000.000-00" />
        <Input label="Telefone" value={newClient.phone} onChange={(v:string) => setNewClient((e:any) => ({...e, phone:v}))} type="tel" placeholder="(00) 00000-0000" />
        <Input label="E-mail" value={newClient.email} onChange={(v:string) => setNewClient((e:any) => ({...e, email:v}))} type="email" placeholder="cliente@email.com" />
        <Input label="Endereço" value={newClient.address} onChange={(v:string) => setNewClient((e:any) => ({...e, address:v}))} placeholder="Endereço completo" />
      </Modal>

      {/* Cadastro rápido de produto */}
      <Modal open={productModal} onClose={() => setProductModal(false)} title="Novo Produto"
        footer={<><Btn onClick={() => setProductModal(false)}>Cancelar</Btn><Btn onClick={saveProduct} variant="primary" size="md">Salvar</Btn></>}>
        <Input label="Nome do Produto *" value={newProduct.name} onChange={(v:string) => setNewProduct((e:any) => ({...e, name:v}))} placeholder="Ex: Lenha Picada, Cavaco..." />
        <Select label="Unidade" value={newProduct.unit||'ton'} onChange={(v:string) => setNewProduct((e:any) => ({...e, unit:v}))}
          options={['ton','ster','m³','kg','unid']} />
      </Modal>
    </div>
  )
}
