'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Input, SH, Empty } from '@/components/ui'
import { clearLogoCache } from '@/lib/pdf'
import type { UserProfile } from '@/types'
import toast from 'react-hot-toast'

export default function ConfigPage({ profile }: { profile: UserProfile }) {
  const [configs, setConfigs] = useState<any[]>([])
  const [precos, setPrecos]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [edits, setEdits]     = useState<Record<string,string>>({})
  const [editPrecos, setEditPrecos] = useState<Record<string,string>>({})
  const [novoForn, setNovoForn]   = useState('')
  const [novoPreco, setNovoPreco] = useState('')
  const [logo, setLogo]           = useState<string|null>(null)
  const [savingLogo, setSavingLogo] = useState(false)

  const isSuper = profile?.role === 'superadmin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [c, p, lg] = await Promise.all([
      supabase.from('system_config').select('*').order('categoria').order('chave'),
      supabase.from('precos').select('*').order('supplier_name'),
      supabase.from('system_config').select('valor_texto').eq('categoria','empresa').eq('chave','logo_base64').maybeSingle(),
    ])
    if (c.error) { toast.error('Execute o SQL da tabela system_config'); setLoading(false); return }
    setConfigs((c.data || []).filter((x:any)=>!(x.categoria==='empresa' && x.chave==='logo_base64')))
    setPrecos(p.data || [])
    setLogo((lg.data?.valor_texto && String(lg.data.valor_texto).startsWith('data:image')) ? lg.data.valor_texto : null)
    setLoading(false)
  }

  async function salvarConfig(chave: string) {
    if (saving) return
    const novoValor = edits[chave]
    if (novoValor === undefined || novoValor === '') { toast.error('Informe um valor'); return }
    const num = parseFloat(novoValor.replace(',', '.'))
    if (isNaN(num) || num <= 0) { toast.error('Valor inválido'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('system_config')
        .update({ valor: num, atualizado_em: new Date().toISOString(), atualizado_por: profile?.display_name || '' })
        .eq('chave', chave)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Parâmetro atualizado')
      setEdits(e => { const n = {...e}; delete n[chave]; return n })
      load()
    } finally { setSaving(false) }
  }

  async function salvarPreco(id: string, supplier_name: string) {
    if (saving) return
    const novoValor = editPrecos[id]
    if (novoValor === undefined || novoValor === '') { toast.error('Informe um preço'); return }
    const num = parseFloat(novoValor.replace(',', '.'))
    if (isNaN(num) || num < 0) { toast.error('Preço inválido'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('precos').update({ price_ton: num }).eq('id', id)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success(`Preço de ${supplier_name} atualizado`)
      setEditPrecos(e => { const n = {...e}; delete n[id]; return n })
      load()
    } finally { setSaving(false) }
  }

  async function adicionarPreco() {
    if (saving) return
    if (!novoForn.trim()) { toast.error('Informe o fornecedor'); return }
    const num = parseFloat((novoPreco || '').replace(',', '.'))
    if (isNaN(num) || num < 0) { toast.error('Preço inválido'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('precos').insert({
        supplier_name: novoForn.trim().toUpperCase(), price_ton: num,
        company_id: profile?.company_id || null,
      })
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Preço adicionado')
      setNovoForn(''); setNovoPreco(''); load()
    } finally { setSaving(false) }
  }

  const fmt = (v:any) => Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})

  if (!isSuper) {
    return <Empty icon="🔒" text="Acesso restrito ao Super Admin." />
  }

  // ── Logo da empresa: upload (redimensiona p/ max 400px) → base64 → system_config ──
  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem (PNG ou JPG)'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = async () => {
        const max = 400
        let w = img.width, h = img.height
        if (w > max || h > max) { const r = Math.min(max/w, max/h); w = Math.round(w*r); h = Math.round(h*r) }
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d'); if (!ctx) return
        ctx.drawImage(img, 0, 0, w, h)
        const isPng = file.type.includes('png')
        const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.9)
        await salvarLogo(dataUrl)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  async function salvarLogo(dataUrl: string|null) {
    setSavingLogo(true)
    // upsert manual: tenta update; se não existir, insert
    const { data: ex } = await supabase.from('system_config').select('id').eq('categoria','empresa').eq('chave','logo_base64').maybeSingle()
    let error:any = null
    if (ex) {
      const r = await supabase.from('system_config').update({ valor_texto: dataUrl, atualizado_em: new Date().toISOString(), atualizado_por: profile?.display_name||'' }).eq('id', ex.id)
      error = r.error
    } else {
      const r = await supabase.from('system_config').insert({ categoria:'empresa', chave:'logo_base64', valor: 0, valor_texto: dataUrl })
      error = r.error
    }
    setSavingLogo(false)
    if (error) { toast.error('Erro ao salvar logo: ' + error.message); return }
    setLogo(dataUrl); clearLogoCache()
    toast.success(dataUrl ? 'Logo salva ✅ (aparecerá nos relatórios)' : 'Logo removida')
  }

  if (loading) return <Empty icon="⏳" text="Carregando configurações..." />

  // Agrupar configs por categoria
  const porCategoria: Record<string, any[]> = {}
  configs.forEach(c => {
    const k = c.categoria || 'Geral'
    if (!porCategoria[k]) porCategoria[k] = []
    porCategoria[k].push(c)
  })

  return (
    <div>
      <SH>⚙️ Configurações do Sistema</SH>
      <div style={{fontSize:'11px', color:'var(--t3)', marginBottom:'16px'}}>
        Parâmetros de cálculo usados em todo o sistema. Alterar aqui afeta os cálculos de produção, custo e combustível. Edite com cuidado.
      </div>

      {/* Logo da empresa (aparece nos relatórios/PDFs) */}
      <div className="rounded-2xl p-4 mb-3" style={{background:'var(--s1)', border:'1px solid var(--bd)'}}>
        <div style={{fontSize:'12px', fontWeight:700, color:'var(--cy)', marginBottom:'4px'}}>🖼️ Logo da Empresa</div>
        <div style={{fontSize:'10px', color:'var(--t3)', marginBottom:'12px'}}>
          Aparece no topo de todos os relatórios em PDF. Use PNG ou JPG — o ideal é fundo transparente (PNG).
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div style={{width:'120px', height:'70px', borderRadius:'12px', background:'var(--s2)', border:'1px dashed var(--bd2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0}}>
            {logo
              ? <img src={logo} alt="Logo" style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />
              : <span style={{fontSize:'10px', color:'var(--t3)'}}>Sem logo</span>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <label style={{display:'inline-flex', alignItems:'center', padding:'9px 16px', borderRadius:'11px', fontSize:'12px', fontWeight:700, cursor: savingLogo?'wait':'pointer', background:'linear-gradient(135deg,#f97316,#c2410c)', color:'#fff', opacity: savingLogo?.6:1}}>
              {savingLogo ? 'Enviando...' : (logo ? 'Trocar logo' : 'Enviar logo')}
              <input type="file" accept="image/png,image/jpeg" onChange={onPickLogo} disabled={savingLogo} style={{display:'none'}} />
            </label>
            {logo && <Btn onClick={()=>salvarLogo(null)} variant="danger" size="md" disabled={savingLogo}>Remover</Btn>}
          </div>
        </div>
      </div>

      {/* Parâmetros de cálculo */}
      {Object.keys(porCategoria).map(cat => (
        <div key={cat} className="rounded-2xl p-4 mb-3" style={{background:'var(--s1)', border:'1px solid var(--bd)'}}>
          <div style={{fontSize:'12px', fontWeight:700, color:'var(--cy)', marginBottom:'10px'}}>{cat}</div>
          <div className="flex flex-col gap-3">
            {porCategoria[cat].map(c => (
              <div key={c.chave} className="rounded-xl p-3" style={{background:'var(--s2)', border:'1px solid var(--bd)'}}>
                <div style={{fontSize:'12px', fontWeight:600, color:'var(--t1)', marginBottom:'2px'}}>
                  {c.chave} {c.unidade ? <span style={{color:'var(--t3)', fontWeight:400}}>({c.unidade})</span> : null}
                </div>
                <div style={{fontSize:'10px', color:'var(--t3)', marginBottom:'8px'}}>{c.descricao}</div>
                <div className="flex items-end gap-2">
                  <div style={{flex:1}}>
                    <Input label="Valor" type="number"
                      value={edits[c.chave] !== undefined ? edits[c.chave] : String(c.valor)}
                      onChange={(v:string) => setEdits(e => ({...e, [c.chave]: v}))} />
                  </div>
                  <Btn onClick={() => salvarConfig(c.chave)} variant="primary" size="md" disabled={saving}>
                    {saving ? '...' : 'Salvar'}
                  </Btn>
                </div>
                {c.atualizado_por && (
                  <div style={{fontSize:'9px', color:'var(--t3)', marginTop:'6px'}}>
                    Última alteração por {c.atualizado_por}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Preços por fornecedor */}
      <div className="rounded-2xl p-4 mb-3" style={{background:'var(--s1)', border:'1px solid var(--bd)'}}>
        <div style={{fontSize:'12px', fontWeight:700, color:'var(--cy)', marginBottom:'4px'}}>Preços de Madeira por Fornecedor (R$/tonelada)</div>
        <div style={{fontSize:'10px', color:'var(--t3)', marginBottom:'10px'}}>
          Usado como preço padrão ao lançar entrada de madeira de cada fornecedor.
        </div>

        <div className="flex flex-col gap-2">
          {precos.length === 0 && <div style={{fontSize:'11px', color:'var(--t3)'}}>Nenhum preço cadastrado.</div>}
          {precos.map(p => (
            <div key={p.id} className="rounded-xl p-2 flex items-end gap-2" style={{background:'var(--s2)', border:'1px solid var(--bd)'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:'12px', fontWeight:600, color:'var(--t1)', marginBottom:'4px'}}>{p.supplier_name}</div>
                <Input label="R$/t" type="number"
                  value={editPrecos[p.id] !== undefined ? editPrecos[p.id] : String(p.price_ton)}
                  onChange={(v:string) => setEditPrecos(e => ({...e, [p.id]: v}))} />
              </div>
              <Btn onClick={() => salvarPreco(p.id, p.supplier_name)} variant="primary" size="md" disabled={saving}>
                {saving ? '...' : 'Salvar'}
              </Btn>
            </div>
          ))}
        </div>

        <div style={{height:'1px', background:'var(--bd)', margin:'12px 0'}} />
        <div style={{fontSize:'11px', fontWeight:600, color:'var(--t2)', marginBottom:'6px'}}>Adicionar novo preço</div>
        <div className="flex items-end gap-2">
          <div style={{flex:1}}>
            <Input label="Fornecedor" value={novoForn} onChange={(v:string) => setNovoForn(v)} placeholder="Nome do fornecedor" />
          </div>
          <div style={{width:'110px'}}>
            <Input label="R$/t" type="number" value={novoPreco} onChange={(v:string) => setNovoPreco(v)} placeholder="0.00" />
          </div>
          <Btn onClick={adicionarPreco} variant="primary" size="md" disabled={saving}>Adicionar</Btn>
        </div>
      </div>
    </div>
  )
}
