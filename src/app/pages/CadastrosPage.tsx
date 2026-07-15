'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, Badge, Textarea, useConfirm } from '@/components/ui'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

type Tab = 'pessoas'|'veiculos'
type Filter = 'all'|'fornecedor'|'cliente'|'motorista'|'funcionario'|'transportador'|'inativo'

function maskDoc(v: string, tipo: string) {
  const d = v.replace(/\D/g,'')
  if (tipo === 'juridica') return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5').slice(0,18)
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4').slice(0,14)
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g,'').slice(0,11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
}
function maskPlate(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7)
}

export default function CadastrosPage({ profile, can }: Props) {
  const [tab, setTab]       = useState<Tab>('pessoas')
  const [items, setItems]   = useState<any[]>([])
  const [veiculos, setVeiculos] = useState<any[]>([])
  const [transportadores, setTransportadores] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [vModal, setVModal] = useState(false)
  const [view, setView]     = useState<any>(null)
  const [editing, setEditing] = useState<any>({})
  const [editVeic, setEditVeic] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const { confirm, dialog }   = useConfirm()

  useEffect(() => { tab === 'pessoas' ? load() : loadVeiculos() }, [filter, tab])

  async function load() {
    setLoading(true)
    let q = supabase.from('cadastros').select('*').order('nome_razao')
    if (filter === 'fornecedor')       q = q.eq('is_fornecedor', true).eq('status', true)
    else if (filter === 'cliente')      q = q.eq('is_cliente', true).eq('status', true)
    else if (filter === 'motorista')    q = q.eq('is_motorista', true).eq('status', true)
    else if (filter === 'funcionario')  q = q.eq('is_funcionario', true).eq('status', true)
    else if (filter === 'transportador') q = q.eq('is_transportador', true).eq('status', true)
    else if (filter === 'inativo')      q = q.eq('status', false)
    else q = q.eq('status', true)
    const { data, error } = await q
    if (error) toast.error('Erro: ' + error.message)
    setItems(data || [])
    setLoading(false)
  }

  async function loadVeiculos() {
    setLoading(true)
    const [v, t] = await Promise.all([
      supabase.from('veiculos').select('*').order('placa'),
      supabase.from('cadastros').select('id,nome_razao').eq('is_transportador', true).eq('status', true),
    ])
    if (v.error) toast.error('Erro: ' + v.error.message)
    setVeiculos(v.data || [])
    setTransportadores(t.data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing({ tipo_pessoa:'fisica', status:true, is_fornecedor:false, is_cliente:false, is_motorista:false, is_funcionario:false, is_transportador:false })
    setModal(true)
  }

  async function save() {
    if (!editing.nome_razao?.trim()) { toast.error('Informe o nome/razão social'); return }
    const hasPapel = editing.is_fornecedor||editing.is_cliente||editing.is_motorista||editing.is_funcionario||editing.is_transportador
    if (!hasPapel) { toast.error('Selecione ao menos um papel'); return }
    setSaving(true)
    const obj = {
      nome_razao: editing.nome_razao.trim(),
      nome_fantasia: editing.nome_fantasia||null,
      documento: editing.documento?.replace(/\D/g,'')||null,
      tipo_pessoa: editing.tipo_pessoa||'fisica',
      telefone: editing.telefone||null,
      whatsapp: editing.whatsapp||null,
      email: editing.email||null,
      endereco: editing.endereco||null,
      cidade: editing.cidade||null,
      estado: editing.estado||null,
      cargo: editing.cargo||null,
      cnh: editing.cnh||null,
      cnh_validade: editing.cnh_validade||null,
      observacao: editing.observacao||null,
      status: editing.status !== false,
      is_fornecedor: !!editing.is_fornecedor,
      is_cliente: !!editing.is_cliente,
      is_motorista: !!editing.is_motorista,
      is_funcionario: !!editing.is_funcionario,
      is_transportador: !!editing.is_transportador,
      created_by: profile?.display_name||'',
    }
    const { error } = editing.id
      ? await supabase.from('cadastros').update(obj).eq('id', editing.id)
      : await supabase.from('cadastros').insert({ ...obj, company_id: profile?.company_id||null })
    if (error) { toast.error('Erro: '+error.message); setSaving(false); return }
    toast.success(editing.id ? 'Atualizado ✅' : 'Cadastrado ✅')
    setSaving(false); setModal(false); load()
  }

  async function saveVeiculo() {
    if (!editVeic.placa?.trim()) { toast.error('Informe a placa'); return }
    setSaving(true)
    const t = transportadores.find(x => x.id === editVeic.transportador_id)
    const obj = {
      placa: editVeic.placa.trim().toUpperCase(),
      tipo: editVeic.tipo||'Caminhão',
      modelo: editVeic.modelo||null,
      marca: editVeic.marca||null,
      ano: editVeic.ano ? parseInt(editVeic.ano) : null,
      capacidade_ton: editVeic.capacidade_ton ? parseFloat(editVeic.capacidade_ton) : null,
      transportador_id: editVeic.transportador_id||null,
      transportador_nome: t?.nome_razao||null,
      observacao: editVeic.observacao||null,
      status: editVeic.status !== false,
      created_by: profile?.display_name||'',
    }
    const { error } = editVeic.id
      ? await supabase.from('veiculos').update(obj).eq('id', editVeic.id)
      : await supabase.from('veiculos').insert({ ...obj, company_id: profile?.company_id||null })
    if (error) { toast.error('Erro: '+error.message); setSaving(false); return }
    toast.success(editVeic.id ? 'Veículo atualizado ✅' : 'Veículo cadastrado ✅')
    setSaving(false); setVModal(false); loadVeiculos()
  }

  async function toggleStatus(item: any, tbl='cadastros') {
    const { error } = await supabase.from(tbl).update({ status: !item.status }).eq('id', item.id)
    if (error) { toast.error('Erro: '+error.message); return }
    toast.success(item.status ? 'Inativado' : 'Reativado')
    tbl === 'cadastros' ? load() : loadVeiculos()
  }

  const filtered = items.filter(i => !search ||
    i.nome_razao?.toLowerCase().includes(search.toLowerCase()) ||
    i.nome_fantasia?.toLowerCase().includes(search.toLowerCase()) ||
    i.documento?.includes(search.replace(/\D/g,'')) ||
    i.telefone?.includes(search))

  const filteredV = veiculos.filter(v => !search ||
    v.placa?.toLowerCase().includes(search.toLowerCase()) ||
    v.modelo?.toLowerCase().includes(search.toLowerCase()) ||
    v.transportador_nome?.toLowerCase().includes(search.toLowerCase()))

  const FILTERS: {id:Filter; label:string}[] = [
    {id:'all', label:'👥 Todos'},
    {id:'fornecedor', label:'🏭 Fornecedores'},
    {id:'cliente', label:'🤝 Clientes'},
    {id:'motorista', label:'🚗 Motoristas'},
    {id:'funcionario', label:'👷 Funcionários'},
    {id:'transportador', label:'🚛 Transportadores'},
    {id:'inativo', label:'⚪ Inativos'},
  ]

  function PapelBadge({item}: {item:any}) {
    return (
      <div className="flex flex-wrap gap-1">
        {item.is_fornecedor && <Badge color="orange">🏭 Fornecedor</Badge>}
        {item.is_cliente && <Badge color="blue">🤝 Cliente</Badge>}
        {item.is_motorista && <Badge color="green">🚗 Motorista</Badge>}
        {item.is_funcionario && <Badge color="amber">👷 Funcionário</Badge>}
        {item.is_transportador && <Badge color="purple">🚛 Transportador</Badge>}
      </div>
    )
  }

  function Checkbox({ label, checked, onChange }: any) {
    return (
      <div onClick={() => onChange(!checked)}
        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 12px', borderRadius:'10px', cursor:'pointer',
          background: checked ? 'rgba(249,115,22,.1)' : 'var(--s2)',
          border: `1px solid ${checked ? 'rgba(249,115,22,.4)' : 'var(--bd)'}`, marginBottom:'6px' }}>
        <div style={{ width:'18px', height:'18px', borderRadius:'4px', border:`2px solid ${checked?'#f97316':'var(--bd)'}`,
          background: checked?'#f97316':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {checked && <span style={{color:'#fff',fontSize:'12px',fontWeight:900}}>✓</span>}
        </div>
        <span style={{ fontSize:'13px', fontWeight:checked?700:400, color:checked?'#f97316':'var(--t1)' }}>{label}</span>
      </div>
    )
  }

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="👥 Cadastros" action={
        tab === 'pessoas'
          ? <Btn onClick={openNew} variant="primary" size="sm">+ Novo</Btn>
          : <Btn onClick={() => { setEditVeic({tipo:'Caminhão',status:true}); setVModal(true) }} variant="primary" size="sm">+ Veículo</Btn>
      } />

      {/* Tabs Pessoas / Veículos */}
      <div className="flex gap-2 mb-3">
        {([['pessoas','👥 Pessoas / Empresas'],['veiculos','🚛 Veículos']] as [Tab,string][]).map(([t,l]) => (
          <div key={t} onClick={() => { setTab(t); setSearch(''); setLoading(true) }}
            style={{ flex:1, textAlign:'center', padding:'9px', borderRadius:'12px', fontSize:'12px', fontWeight:700, cursor:'pointer',
              background: tab===t ? 'rgba(249,115,22,.12)' : 'var(--s1)',
              border: `1px solid ${tab===t ? 'rgba(249,115,22,.4)' : 'var(--bd)'}`,
              color: tab===t ? '#f97316' : 'var(--t2)' }}>
            {l}
          </div>
        ))}
      </div>

      {tab === 'pessoas' && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <div key={f.id} onClick={() => setFilter(f.id)}
              style={{ flexShrink:0, padding:'6px 12px', borderRadius:'20px', fontSize:'11px', fontWeight:700, cursor:'pointer',
                background: filter===f.id ? 'rgba(249,115,22,.12)' : 'var(--s1)',
                border: `1px solid ${filter===f.id ? 'rgba(249,115,22,.4)' : 'var(--bd)'}`,
                color: filter===f.id ? '#f97316' : 'var(--t2)', whiteSpace:'nowrap' }}>
              {f.label}
            </div>
          ))}
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder={tab==='pessoas' ? '🔍 Buscar nome, documento, telefone...' : '🔍 Buscar placa, modelo, transportador...'}
        style={{ width:'100%', background:'var(--s2)', border:'1px solid var(--bd)', borderRadius:'10px',
          padding:'9px 12px', color:'var(--t1)', fontFamily:'Sora,system-ui', fontSize:'12px',
          outline:'none', marginBottom:'10px', boxSizing:'border-box' }} />

      {/* ═══ LISTA PESSOAS ═══ */}
      {tab === 'pessoas' && (
        loading ? <Empty icon="⏳" text="Carregando..." /> :
        filtered.length === 0 ? <Empty icon="👥" text="Nenhum cadastro encontrado." /> : (
          <div className="flex flex-col gap-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setView(item)}
                className="rounded-xl p-3 cursor-pointer"
                style={{ background:'var(--s1)', border:'1px solid var(--bd)', opacity: item.status?1:0.6 }}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-bold text-sm mb-1">
                      {!item.status && <span style={{color:'var(--t3)'}}>[INATIVO] </span>}
                      {item.nome_razao}
                      {item.nome_fantasia && <span style={{color:'var(--t3)',fontWeight:400}}> · {item.nome_fantasia}</span>}
                    </div>
                    <PapelBadge item={item} />
                    <div className="text-xs mt-1 flex gap-3 flex-wrap" style={{color:'var(--t3)'}}>
                      {item.documento && <span>📄 {item.documento}</span>}
                      {item.telefone && <span>📞 {item.telefone}</span>}
                      {item.cargo && <span>💼 {item.cargo}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                    <Btn onClick={() => { setEditing(item); setModal(true) }} size="sm">✏️</Btn>
                    <Btn onClick={() => toggleStatus(item)} size="sm" variant="secondary">{item.status?'⛔':'✅'}</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══ LISTA VEÍCULOS ═══ */}
      {tab === 'veiculos' && (
        loading ? <Empty icon="⏳" text="Carregando..." /> :
        filteredV.length === 0 ? <Empty icon="🚛" text="Nenhum veículo cadastrado." /> : (
          <div className="flex flex-col gap-2">
            {filteredV.map(v => (
              <div key={v.id} className="rounded-xl p-3"
                style={{ background:'var(--s1)', border:'1px solid var(--bd)', opacity: v.status?1:0.6 }}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold" style={{fontSize:'15px',color:'var(--cy)',letterSpacing:'1px'}}>{v.placa}</span>
                      <Badge color="blue">{v.tipo}</Badge>
                      {!v.status && <Badge color="gray">Inativo</Badge>}
                    </div>
                    <div className="text-xs" style={{color:'var(--t2)'}}>
                      {[v.marca, v.modelo, v.ano].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="text-xs mt-0.5 flex gap-3" style={{color:'var(--t3)'}}>
                      {v.capacidade_ton && <span>⚖️ {v.capacidade_ton} t</span>}
                      {v.transportador_nome && <span>🚛 {v.transportador_nome}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Btn onClick={() => { setEditVeic(v); setVModal(true) }} size="sm">✏️</Btn>
                    <Btn onClick={() => toggleStatus(v, 'veiculos')} size="sm" variant="secondary">{v.status?'⛔':'✅'}</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══ DETALHE PESSOA ═══ */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.nome_razao || ''}>
        {view && (
          <div className="flex flex-col gap-1">
            <div className="mb-2"><PapelBadge item={view} /></div>
            {[
              ['Tipo', view.tipo_pessoa === 'juridica' ? '🏢 Jurídica' : '👤 Física'],
              ['Documento', view.documento || '—'],
              ['Nome Fantasia', view.nome_fantasia || '—'],
              ['Telefone', view.telefone || '—'],
              ['WhatsApp', view.whatsapp || '—'],
              ['E-mail', view.email || '—'],
              ['Cargo', view.cargo || '—'],
              ['CNH', view.cnh ? `${view.cnh}${view.cnh_validade ? ' (val. '+view.cnh_validade+')' : ''}` : '—'],
              ['Endereço', view.endereco || '—'],
              ['Cidade/UF', view.cidade ? `${view.cidade}${view.estado?' - '+view.estado:''}` : '—'],
              ['Observação', view.observacao || '—'],
              ['Status', view.status ? '✅ Ativo' : '⛔ Inativo'],
            ].map(([l,v],i) => (
              <div key={i} className="flex justify-between py-1.5 border-b" style={{borderColor:'var(--bd)',fontSize:'12px'}}>
                <span style={{color:'var(--t3)'}}>{l}</span>
                <span style={{fontWeight:600,textAlign:'right',maxWidth:'60%'}}>{v}</span>
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <Btn onClick={() => { setEditing(view); setView(null); setModal(true) }} variant="primary" size="md">✏️ Editar</Btn>
              {view.whatsapp && <Btn onClick={() => window.open(`https://wa.me/55${view.whatsapp.replace(/\D/g,'')}`,'_blank')} variant="secondary" size="md">💬 WhatsApp</Btn>}
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ FORM PESSOA ═══ */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing.id ? 'Editar Cadastro' : 'Novo Cadastro'}
        footer={<>
          <Btn onClick={() => setModal(false)}>Cancelar</Btn>
          <Btn onClick={save} variant="primary" size="md" disabled={saving}>{saving?'Salvando...':'Salvar'}</Btn>
        </>}>

        <div style={{fontSize:'9px',fontWeight:700,color:'rgba(249,115,22,.65)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>
          PAPÉIS DESTE CADASTRO *
        </div>
        <Checkbox label="🏭 Fornecedor (aba Madeira, Compras, Consertos)" checked={!!editing.is_fornecedor} onChange={(v:boolean)=>setEditing((e:any)=>({...e,is_fornecedor:v}))} />
        <Checkbox label="🤝 Cliente (aba Vendas)" checked={!!editing.is_cliente} onChange={(v:boolean)=>setEditing((e:any)=>({...e,is_cliente:v}))} />
        <Checkbox label="🚗 Motorista (Madeira e Vendas)" checked={!!editing.is_motorista} onChange={(v:boolean)=>setEditing((e:any)=>({...e,is_motorista:v}))} />
        <Checkbox label="👷 Funcionário (EPIs, Treinamentos)" checked={!!editing.is_funcionario} onChange={(v:boolean)=>setEditing((e:any)=>({...e,is_funcionario:v}))} />
        <Checkbox label="🚛 Transportador (vincula veículos)" checked={!!editing.is_transportador} onChange={(v:boolean)=>setEditing((e:any)=>({...e,is_transportador:v}))} />

        <div style={{height:'1px',background:'var(--bd)',margin:'10px 0'}} />

        <Select label="Tipo de Pessoa *" value={editing.tipo_pessoa||'fisica'}
          onChange={(v:string) => setEditing((e:any) => ({...e, tipo_pessoa:v, documento:''}))}
          options={[{value:'fisica',label:'👤 Pessoa Física'},{value:'juridica',label:'🏢 Pessoa Jurídica'}]} />

        <Input label="Nome / Razão Social *" value={editing.nome_razao}
          onChange={(v:string) => setEditing((e:any) => ({...e, nome_razao:v}))} placeholder="Nome completo ou razão social" />

        {editing.tipo_pessoa === 'juridica' && (
          <Input label="Nome Fantasia" value={editing.nome_fantasia}
            onChange={(v:string) => setEditing((e:any) => ({...e, nome_fantasia:v}))} placeholder="Nome comercial" />
        )}

        <Input label={editing.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'} value={editing.documento}
          onChange={(v:string) => setEditing((e:any) => ({...e, documento: maskDoc(v, editing.tipo_pessoa||'fisica')}))}
          placeholder={editing.tipo_pessoa === 'juridica' ? '00.000.000/0000-00' : '000.000.000-00'} />

        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Telefone" value={editing.telefone} onChange={(v:string) => setEditing((e:any) => ({...e, telefone: maskPhone(v)}))} placeholder="(00) 00000-0000" type="tel" />
          <Input label="WhatsApp" value={editing.whatsapp} onChange={(v:string) => setEditing((e:any) => ({...e, whatsapp: maskPhone(v)}))} placeholder="(00) 00000-0000" type="tel" />
        </div>

        <Input label="E-mail" value={editing.email} onChange={(v:string) => setEditing((e:any) => ({...e, email:v}))} placeholder="email@exemplo.com" type="email" />

        {(editing.is_funcionario || editing.is_motorista) && <>
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Cargo / Função" value={editing.cargo} onChange={(v:string) => setEditing((e:any) => ({...e, cargo:v}))} placeholder="Ex: Operador, Motorista..." />
            <Input label="CNH" value={editing.cnh} onChange={(v:string) => setEditing((e:any) => ({...e, cnh:v}))} placeholder="Nº da CNH" />
          </div>
          <Input label="Validade CNH" value={editing.cnh_validade} onChange={(v:string) => setEditing((e:any) => ({...e, cnh_validade:v}))} type="date" />
        </>}

        <Input label="Endereço" value={editing.endereco} onChange={(v:string) => setEditing((e:any) => ({...e, endereco:v}))} placeholder="Rua, número, bairro..." />

        <div className="grid grid-cols-3 gap-x-2">
          <div style={{gridColumn:'span 2'}}>
            <Input label="Cidade" value={editing.cidade} onChange={(v:string) => setEditing((e:any) => ({...e, cidade:v}))} placeholder="Vacaria" />
          </div>
          <Input label="UF" value={editing.estado} onChange={(v:string) => setEditing((e:any) => ({...e, estado:v.toUpperCase().slice(0,2)}))} placeholder="RS" />
        </div>

        <Textarea label="Observação" value={editing.observacao} onChange={(v:string) => setEditing((e:any) => ({...e, observacao:v}))} rows={2} placeholder="Observações gerais..." />
      </Modal>

      {/* ═══ FORM VEÍCULO ═══ */}
      <Modal open={vModal} onClose={() => setVModal(false)}
        title={editVeic.id ? 'Editar Veículo' : 'Novo Veículo'}
        footer={<>
          <Btn onClick={() => setVModal(false)}>Cancelar</Btn>
          <Btn onClick={saveVeiculo} variant="primary" size="md" disabled={saving}>{saving?'Salvando...':'Salvar'}</Btn>
        </>}>

        <Input label="Placa *" value={editVeic.placa} onChange={(v:string) => setEditVeic((e:any) => ({...e, placa: maskPlate(v)}))} placeholder="AAA0A00 ou AAA0000" />

        <div className="grid grid-cols-2 gap-x-3">
          <Select label="Tipo" value={editVeic.tipo||'Caminhão'} onChange={(v:string) => setEditVeic((e:any) => ({...e, tipo:v}))}
            options={['Caminhão','Carreta','Bitrem','Caminhonete','Utilitário','Empilhadeira','Trator','Outro']} />
          <Input label="Capacidade (ton)" value={editVeic.capacidade_ton} onChange={(v:string) => setEditVeic((e:any) => ({...e, capacidade_ton:v}))} type="number" placeholder="0.0" />
        </div>

        <div className="grid grid-cols-3 gap-x-2">
          <Input label="Marca" value={editVeic.marca} onChange={(v:string) => setEditVeic((e:any) => ({...e, marca:v}))} placeholder="Volvo, Scania..." />
          <Input label="Modelo" value={editVeic.modelo} onChange={(v:string) => setEditVeic((e:any) => ({...e, modelo:v}))} placeholder="FH 540..." />
          <Input label="Ano" value={editVeic.ano} onChange={(v:string) => setEditVeic((e:any) => ({...e, ano:v}))} type="number" placeholder="2020" />
        </div>

        <Select label="Transportador vinculado" value={editVeic.transportador_id||''}
          onChange={(v:string) => setEditVeic((e:any) => ({...e, transportador_id:v}))}
          options={[{value:'',label:'Frota própria / Nenhum'}, ...transportadores.map(t => ({value:t.id, label:t.nome_razao}))]} />

        <Textarea label="Observação" value={editVeic.observacao} onChange={(v:string) => setEditVeic((e:any) => ({...e, observacao:v}))} rows={2} placeholder="Opcional..." />
      </Modal>
    </div>
  )
}
