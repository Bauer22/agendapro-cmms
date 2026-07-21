'use client'
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ── Button
type BtnVariant = 'primary'|'secondary'|'danger'
type BtnSize = 'sm'|'md'|'lg'
const BV: Record<BtnVariant,{bg:string;color:string}> = {
  primary:   { bg:'linear-gradient(135deg,#f97316,#c85a00)', color:'#fff' },
  secondary: { bg:'rgba(249,115,22,.1)', color:'#f97316' },
  danger:    { bg:'rgba(239,68,68,.1)',  color:'#ef4444' },
}
const BS: Record<BtnSize,{padding:string;fontSize:string;borderRadius:string}> = {
  sm: { padding:'5px 10px',  fontSize:'11px', borderRadius:'8px'  },
  md: { padding:'9px 16px',  fontSize:'12px', borderRadius:'10px' },
  lg: { padding:'12px 24px', fontSize:'14px', borderRadius:'12px' },
}
export function Btn({ children, onClick, variant='secondary', size='sm', disabled, className }: any) {
  const v = BV[variant as BtnVariant]; const s = BS[size as BtnSize]
  return (
    <button onClick={onClick} disabled={disabled} className={className}
      style={{...s, background:v.bg, color:v.color, border:`1px solid ${variant==='secondary'?'rgba(249,115,22,.28)':variant==='danger'?'rgba(239,68,68,.28)':'transparent'}`, fontFamily:"'Sora',system-ui", fontWeight:700, cursor:disabled?'not-allowed':'pointer', opacity:disabled?.5:1, whiteSpace:'nowrap', flexShrink:0}}>
      {children}
    </button>
  )
}

// ── Badge
const BC: Record<string,{bg:string;color:string;border:string}> = {
  blue:   {bg:'rgba(59,130,246,.12)',  color:'#60a5fa', border:'rgba(59,130,246,.2)'},
  orange: {bg:'rgba(249,115,22,.12)',  color:'#f97316', border:'rgba(249,115,22,.2)'},
  green:  {bg:'rgba(34,197,94,.12)',   color:'#4ade80', border:'rgba(34,197,94,.2)'},
  amber:  {bg:'rgba(234,179,8,.12)',   color:'#facc15', border:'rgba(234,179,8,.2)'},
  red:    {bg:'rgba(239,68,68,.12)',   color:'#f87171', border:'rgba(239,68,68,.2)'},
  purple: {bg:'rgba(167,139,250,.12)', color:'#a78bfa', border:'rgba(167,139,250,.2)'},
  gray:   {bg:'rgba(107,114,128,.12)', color:'#9ca3af', border:'rgba(107,114,128,.2)'},
}
export function Badge({ children, color='gray' }: any) {
  const c = BC[color] || BC.gray
  return (
    <span style={{display:'inline-flex',alignItems:'center',padding:'2px 7px',borderRadius:'20px',fontSize:'9px',fontWeight:700,letterSpacing:'.3px',background:c.bg,color:c.color,border:`1px solid ${c.border}`,whiteSpace:'nowrap',flexShrink:0}}>
      {children}
    </span>
  )
}

// ── KPI
export function KPI({ num, label, color='orange' }: any) {
  const c: Record<string,string> = {orange:'#f97316',blue:'#3b82f6',green:'#22c55e',amber:'#f59e0b',red:'#ef4444',purple:'#a78bfa'}
  const clr = c[color] || '#f97316'
  return (
    <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderTop:`2px solid ${clr}`,borderRadius:'14px',padding:'10px 8px',textAlign:'center',position:'relative',overflow:'hidden'}}>
      <div style={{fontFamily:"'Bebas Neue',impact,sans-serif",fontSize:'28px',lineHeight:1,color:clr,marginBottom:'2px'}}>{num}</div>
      <div style={{fontSize:'7px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',fontWeight:600}}>{label}</div>
    </div>
  )
}

// ── SH (Section Header)
export function SH({ label, action }: any) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'.7px',color:'var(--t2)'}}>
        <div style={{width:'3px',height:'14px',background:'linear-gradient(180deg,#f97316,#c85a00)',borderRadius:'2px',boxShadow:'0 0 6px rgba(249,115,22,.5)'}}/>
        {label}
      </div>
      {action}
    </div>
  )
}

// ── Empty
export function Empty({ icon, text }: any) {
  return (
    <div style={{textAlign:'center',padding:'32px 16px',color:'var(--t3)'}}>
      <div style={{fontSize:'32px',marginBottom:'8px'}}>{icon}</div>
      <div style={{fontSize:'12px'}}>{text}</div>
    </div>
  )
}

// ── Input
export function Input({ label, value, onChange, type='text', placeholder, className }: any) {
  return (
    <div style={{marginBottom:'10px'}} className={className}>
      {label&&<label style={{display:'block',fontSize:'9px',fontWeight:700,letterSpacing:'1.2px',color:'rgba(249,115,22,.65)',textTransform:'uppercase',marginBottom:'4px'}}>{label}</label>}
      <input value={value||''} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder}
        style={{width:'100%',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'10px',padding:'9px 12px',color:'var(--t1)',fontFamily:"'Sora',system-ui",fontSize:'12px',outline:'none',transition:'border-color .15s'}}
        onFocus={e=>{e.target.style.borderColor='rgba(249,115,22,.55)';e.target.style.boxShadow='0 0 10px rgba(249,115,22,.12)'}}
        onBlur={e=>{e.target.style.borderColor='var(--bd)';e.target.style.boxShadow='none'}} />
    </div>
  )
}

// ── Select
export function Select({ label, value, onChange, options, className }: any) {
  const opts = Array.isArray(options) ? options.map((o:any) => typeof o==='string' ? {value:o,label:o} : o) : []
  return (
    <div style={{marginBottom:'10px'}} className={className}>
      {label&&<label style={{display:'block',fontSize:'9px',fontWeight:700,letterSpacing:'1.2px',color:'rgba(249,115,22,.65)',textTransform:'uppercase',marginBottom:'4px'}}>{label}</label>}
      <select value={value||''} onChange={e=>onChange(e.target.value)}
        style={{width:'100%',background:'#16284a',border:'1px solid var(--bd)',borderRadius:'10px',padding:'9px 12px',color:'#ffffff',fontFamily:"'Sora',system-ui",fontSize:'12px',outline:'none',WebkitAppearance:'none',colorScheme:'dark'}}>
        {opts.map((o:any,i:number)=><option key={i} value={o.value} style={{background:'#16284a',color:'#ffffff'}}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Textarea
export function Textarea({ label, value, onChange, rows=3, placeholder }: any) {
  return (
    <div style={{marginBottom:'10px'}}>
      {label&&<label style={{display:'block',fontSize:'9px',fontWeight:700,letterSpacing:'1.2px',color:'rgba(249,115,22,.65)',textTransform:'uppercase',marginBottom:'4px'}}>{label}</label>}
      <textarea value={value||''} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{width:'100%',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'10px',padding:'9px 12px',color:'var(--t1)',fontFamily:"'Sora',system-ui",fontSize:'12px',outline:'none',resize:'vertical'}}
        onFocus={e=>{e.target.style.borderColor='rgba(249,115,22,.55)'}}
        onBlur={e=>{e.target.style.borderColor='var(--bd)'}} />
    </div>
  )
}

// ── Modal
export function Modal({ open, onClose, title, children, footer }: any) {
  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'relative',zIndex:1,background:'var(--bg2)',border:'1px solid var(--bd)',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:'520px',maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 -8px 40px rgba(0,0,0,.5)'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,#f97316,transparent)',borderRadius:'20px 20px 0 0'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px 12px',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:700,color:'var(--t1)'}}>{title}</div>
          <button onClick={onClose} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'8px',width:'28px',height:'28px',cursor:'pointer',color:'var(--t2)',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'0 20px 8px'}}>
          {children}
        </div>
        {footer&&<div style={{padding:'12px 20px 16px',borderTop:'1px solid var(--bd)',display:'flex',gap:'8px',justifyContent:'flex-end',flexShrink:0}}>{footer}</div>}
      </div>
    </div>
  )
}

// ── useConfirm
export function useConfirm() {
  const [state, setState] = useState<{msg:string;resolve:(v:boolean)=>void}|null>(null)
  const confirm = useCallback((msg: string): Promise<boolean> => {
    return new Promise(resolve => setState({ msg, resolve }))
  }, [])
  const dialog = state ? (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.7)'}} onClick={()=>{state.resolve(false);setState(null)}}/>
      <div style={{position:'relative',background:'var(--s1)',border:'1px solid rgba(249,115,22,.3)',borderRadius:'16px',padding:'24px',maxWidth:'320px',width:'100%',boxShadow:'0 0 40px rgba(0,0,0,.6)'}}>
        <div style={{fontSize:'13px',color:'var(--t1)',marginBottom:'20px',lineHeight:1.5}}>{state.msg}</div>
        <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
          <Btn onClick={()=>{state.resolve(false);setState(null)}} variant="secondary" size="md">Cancelar</Btn>
          <Btn onClick={()=>{state.resolve(true);setState(null)}} variant="danger" size="md">Confirmar</Btn>
        </div>
      </div>
    </div>
  ) : null
  return { confirm, dialog }
}

// ── SelectComCadastro
// Select com opção "+ Cadastrar novo..." embutida. Ao escolher, abre um mini-modal
// específico do tipo de entidade, insere no Supabase e já seleciona o item criado.
//
// tipo: 'cliente' | 'fornecedor' | 'motorista' | 'produto' | 'veiculo' | 'parceiro'
//   'parceiro' cadastra em `cadastros` com is_cliente E is_fornecedor marcados juntos
//   (uso: telas onde o mesmo dropdown lista clientes e fornecedores, ex. Pagamentos)
//
// onCreated(item) — chamado com {id, name} (ou {id, placa} para veículo) após salvar,
// para o componente pai atualizar sua lista local e selecionar o novo item.

const NOVO_VALUE = '__novo__'

type TipoCadastroRapido = 'cliente'|'fornecedor'|'motorista'|'produto'|'veiculo'|'parceiro'

const TIPO_LABEL: Record<TipoCadastroRapido,string> = {
  cliente: 'Cliente', fornecedor: 'Fornecedor', motorista: 'Motorista',
  produto: 'Produto', veiculo: 'Veículo', parceiro: 'Parceiro',
}

export function SelectComCadastro({
  label, value, onChange, options, tipo, companyId, createdBy, className, onCreatedRefresh,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: {value:string,label:string}[]
  tipo: TipoCadastroRapido
  companyId?: string|null
  createdBy?: string
  className?: string
  onCreatedRefresh?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})
  const [localOptions, setLocalOptions] = useState(options)

  useEffect(() => { setLocalOptions(options) }, [options.length])

  function handleChange(v: string) {
    if (v === NOVO_VALUE) { setForm({}); setOpen(true); return }
    onChange(v)
  }

  async function handleSave() {
    const nome = (form.name || form.placa || '').trim()
    if (!nome) { toast.error(`Informe o nome do ${TIPO_LABEL[tipo].toLowerCase()}`); return }
    setSaving(true)

    let error: any = null
    let novoItem: {value:string,label:string}|null = null

    if (tipo === 'veiculo') {
      const placa = nome.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7)
      const { data, error: e } = await supabase.from('veiculos')
        .insert({ placa, tipo: form.tipoVeic || 'Caminhão', status: true, created_by: createdBy||'', company_id: companyId||null })
        .select('id,placa').single()
      error = e
      if (data) novoItem = { value: data.id, label: data.placa }
    } else if (tipo === 'produto') {
      const { data, error: e } = await supabase.from('products')
        .insert({ name: nome, unit: form.unit || 'ton', active: true, company_id: companyId||null })
        .select('id,name').single()
      error = e
      if (data) novoItem = { value: data.id, label: data.name }
    } else {
      // cliente, fornecedor, motorista, parceiro -> tabela `cadastros`
      const papeis =
        tipo === 'cliente'    ? { is_cliente: true } :
        tipo === 'fornecedor' ? { is_fornecedor: true } :
        tipo === 'motorista'  ? { is_motorista: true } :
        { is_cliente: true, is_fornecedor: true } // parceiro
      const { data, error: e } = await supabase.from('cadastros')
        .insert({
          nome_razao: nome,
          documento: form.document || null,
          telefone: form.phone || null,
          email: form.email || null,
          status: true, ...papeis,
          created_by: createdBy||'', company_id: companyId||null,
        })
        .select('id,nome_razao').single()
      error = e
      if (data) novoItem = { value: data.id, label: data.nome_razao }
    }

    setSaving(false)
    if (error) { toast.error('Erro ao cadastrar: ' + error.message); return }
    if (novoItem) {
      setLocalOptions(prev => [...prev, novoItem!])
      onChange(novoItem.value)
      toast.success(`${TIPO_LABEL[tipo]} cadastrado ✅`)
      onCreatedRefresh?.()
    }
    setOpen(false); setForm({})
  }

  const opts = [
    { value:'', label:'Selecione...' },
    ...localOptions,
    { value: NOVO_VALUE, label: `+ Cadastrar novo ${TIPO_LABEL[tipo].toLowerCase()}...` },
  ]

  return (
    <>
      <Select label={label} value={value} onChange={handleChange} options={opts} className={className} />

      <Modal open={open} onClose={()=>setOpen(false)} title={`+ Novo ${TIPO_LABEL[tipo]}`}
        footer={<><Btn onClick={()=>setOpen(false)}>Cancelar</Btn><Btn onClick={handleSave} variant="primary" size="md" disabled={saving}>{saving?'Salvando...':'Salvar'}</Btn></>}>

        {tipo === 'veiculo' ? (
          <>
            <Input label="Placa *" value={form.name} onChange={(v:string)=>setForm((e:any)=>({...e,name:v.toUpperCase()}))} placeholder="ABC1D23" />
            <Select label="Tipo" value={form.tipoVeic||'Caminhão'} onChange={(v:string)=>setForm((e:any)=>({...e,tipoVeic:v}))}
              options={['Caminhão','Carreta','Truck','Toco','Outro']} />
          </>
        ) : tipo === 'produto' ? (
          <>
            <Input label="Nome do Produto *" value={form.name} onChange={(v:string)=>setForm((e:any)=>({...e,name:v}))} placeholder="Ex: Lenha Picada, Cavaco..." />
            <Select label="Unidade" value={form.unit||'ton'} onChange={(v:string)=>setForm((e:any)=>({...e,unit:v}))}
              options={[{value:'ton',label:'Toneladas'},{value:'m3',label:'Metros cúbicos'},{value:'un',label:'Unidade'}]} />
          </>
        ) : (
          <>
            <Input label="Nome *" value={form.name} onChange={(v:string)=>setForm((e:any)=>({...e,name:v}))} placeholder={`Nome do ${TIPO_LABEL[tipo].toLowerCase()}`} />
            <Input label="CPF / CNPJ" value={form.document} onChange={(v:string)=>setForm((e:any)=>({...e,document:v}))} placeholder="Opcional" />
            <Input label="Telefone" value={form.phone} onChange={(v:string)=>setForm((e:any)=>({...e,phone:v}))} type="tel" placeholder="Opcional" />
            {tipo !== 'motorista' && <Input label="E-mail" value={form.email} onChange={(v:string)=>setForm((e:any)=>({...e,email:v}))} type="email" placeholder="Opcional" />}
          </>
        )}
      </Modal>
    </>
  )
}

