'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select } from '@/components/ui'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// LaminaCalc — seletor de TIPO DE LÂMINA + cálculo automático de m³
//
// Usado no Lançamento de Produção e na Saída de Lâmina.
// Permite somar VÁRIOS tipos no mesmo lançamento (ex.: X folhas de capa
// + Y de capinha no mesmo dia). O total em m³ alimenta o form pai.
//
// Dimensões (largura, comprimento, espessura) são gravadas em METROS,
// então o cálculo devolve o volume direto em m³.
//
// Fórmulas (confirmadas com o cliente):
//   capa / capinha        = nº folhas × largura × comprimento × espessura
//   retalho / aproveitam. = altura × largura × comprimento
//
// Props:
//   value    -> m³ total atual (string, vindo do form pai)
//   onChange -> recebe o m³ total (string) para o form pai gravar
//   companyId, createdBy -> para cadastrar novos tipos
// ═══════════════════════════════════════════════════════════════

interface TipoLamina {
  id: string
  nome: string
  categoria: string
  largura: number
  comprimento: number
  espessura: number | null
  ativo?: boolean
}

interface Linha { tipoId: string; qtd: string }

interface Espessura { id: string; valor_m: number; ativo?: boolean }

const CATEGORIAS = [
  { value: 'capa', label: 'Capa (usa nº de folhas)' },
  { value: 'capinha', label: 'Capinha (usa nº de folhas)' },
  { value: 'retalho', label: 'Retalho (usa altura)' },
  { value: 'aproveitamento', label: 'Aproveitamento (usa altura)' },
]

const usaFolhas = (cat: string) => cat === 'capa' || cat === 'capinha'

export function calcVolumeLamina(tipo: TipoLamina | undefined, quantidade: number): number {
  if (!tipo || !(quantidade > 0)) return 0
  const larg = +tipo.largura || 0
  const comp = +tipo.comprimento || 0
  if (usaFolhas(tipo.categoria)) {
    const esp = +(tipo.espessura || 0)
    return quantidade * larg * comp * esp
  }
  // retalho / aproveitamento: quantidade = altura (m)
  return quantidade * larg * comp
}

export default function LaminaCalc({
  value, onChange, companyId, createdBy,
}: {
  value: string
  onChange: (m3: string) => void
  companyId?: string | null
  createdBy?: string
}) {
  const [tipos, setTipos] = useState<TipoLamina[]>([])
  const [espessuras, setEspessuras] = useState<Espessura[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([{ tipoId: '', qtd: '' }])
  const [modal, setModal] = useState(false)
  const [novo, setNovo] = useState<any>({ categoria: 'capa', espessura: '' })
  const [novaEsp, setNovaEsp] = useState('')   // em mm, para cadastrar
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [t, e] = await Promise.all([
      supabase.from('tipos_lamina').select('*').eq('ativo', true).order('categoria').order('nome'),
      supabase.from('espessuras_lamina').select('*').eq('ativo', true).order('valor_m'),
    ])
    setTipos((t.data as TipoLamina[]) || [])
    setEspessuras((e.data as Espessura[]) || [])
  }

  // opções do select de espessura, montadas do banco (valor em metros; label em mm)
  const espOptions = [
    { value: '', label: espessuras.length ? 'Selecione...' : 'Cadastre uma espessura abaixo' },
    ...espessuras.map(e => ({ value: String(e.valor_m), label: `${(e.valor_m * 1000).toLocaleString('pt-BR')} mm` })),
  ]

  async function salvarEspessura() {
    const mm = parseFloat((novaEsp || '').replace(',', '.'))
    if (!(mm > 0)) { toast.error('Informe a espessura em mm (ex: 2,6)'); return }
    const valor_m = +(mm / 1000).toFixed(6)
    if (espessuras.some(e => Math.abs(e.valor_m - valor_m) < 1e-9)) {
      toast.error('Essa espessura já existe'); return
    }
    const { error } = await supabase.from('espessuras_lamina').insert({
      company_id: companyId || null, valor_m, ativo: true, created_by: createdBy || '',
    })
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Espessura cadastrada ✅')
    setNovaEsp('')
    await load()
    setNovo((e: any) => ({ ...e, espessura: String(valor_m) }))
  }

  async function removerEspessura(id: string) {
    const { error } = await supabase.from('espessuras_lamina').update({ ativo: false }).eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Removida'); load()
  }

  const tipoOf = (id: string) => tipos.find(t => t.id === id)

  const volLinha = (l: Linha) => calcVolumeLamina(tipoOf(l.tipoId), parseFloat(l.qtd) || 0)
  const total = linhas.reduce((s, l) => s + volLinha(l), 0)

  // recalcula o total sempre que as linhas mudam
  useEffect(() => {
    onChange(total > 0 ? total.toFixed(3) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(linhas), tipos])

  function setLinha(i: number, patch: Partial<Linha>) {
    setLinhas(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }
  function addLinha() { setLinhas(ls => [...ls, { tipoId: '', qtd: '' }]) }
  function delLinha(i: number) {
    setLinhas(ls => ls.length <= 1 ? [{ tipoId: '', qtd: '' }] : ls.filter((_, idx) => idx !== i))
  }

  async function salvarTipo() {
    if (!novo.nome?.trim()) { toast.error('Informe o nome do tipo'); return }
    if (!(parseFloat(novo.largura) > 0)) { toast.error('Informe a largura (m)'); return }
    if (!(parseFloat(novo.comprimento) > 0)) { toast.error('Informe o comprimento (m)'); return }
    if (usaFolhas(novo.categoria) && !(parseFloat(novo.espessura) > 0)) {
      toast.error('Selecione a espessura'); return
    }
    setSaving(true)
    const obj: any = {
      company_id: companyId || null,
      nome: novo.nome.trim(),
      categoria: novo.categoria,
      largura: parseFloat(novo.largura),
      comprimento: parseFloat(novo.comprimento),
      espessura: usaFolhas(novo.categoria) ? parseFloat(novo.espessura) : null,
      ativo: true,
      created_by: createdBy || '',
    }
    const { error } = await supabase.from('tipos_lamina').insert(obj)
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('Tipo cadastrado ✅')
    setSaving(false)
    setNovo({ categoria: 'capa', espessura: '' })
    await load()
  }

  return (
    <div className="rounded-lg p-2 mb-2" style={{ background: 'var(--s2)', border: '1px solid var(--bd)' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🧮 Calcular por tipo de lâmina</span>
        <Btn onClick={() => setModal(true)} size="sm">⚙️ Tipos</Btn>
      </div>

      {linhas.map((l, i) => {
        const tipo = tipoOf(l.tipoId)
        const v = volLinha(l)
        return (
          <div key={i} style={{ borderBottom: i < linhas.length - 1 ? '1px dashed var(--bd)' : 'none', paddingBottom: '6px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Select label={i === 0 ? 'Tipo de lâmina' : `Tipo #${i + 1}`} value={l.tipoId}
                  onChange={(v2: string) => setLinha(i, { tipoId: v2 })}
                  options={[
                    { value: '', label: tipos.length ? 'Selecione o tipo...' : 'Nenhum tipo cadastrado — clique em ⚙️ Tipos' },
                    ...tipos.map(t => ({
                      value: t.id,
                      label: `${t.nome} · ${t.categoria}${t.espessura ? ` · ${(t.espessura * 1000).toLocaleString('pt-BR')}mm` : ''}`,
                    })),
                  ]} />
              </div>
              {linhas.length > 1 && (
                <div style={{ paddingTop: '18px' }}>
                  <Btn variant="danger" size="sm" onClick={() => delLinha(i)}>🗑</Btn>
                </div>
              )}
            </div>

            {tipo && (
              <>
                <Input
                  label={usaFolhas(tipo.categoria) ? 'Número de folhas *' : 'Altura (m) *'}
                  value={l.qtd} onChange={(v2: string) => setLinha(i, { qtd: v2 })} type="number"
                  placeholder={usaFolhas(tipo.categoria) ? 'Ex: 500' : 'Ex: 1.20'} />
                <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '-4px', marginBottom: '2px' }}>
                  {usaFolhas(tipo.categoria)
                    ? `folhas × ${tipo.largura} × ${tipo.comprimento} × ${tipo.espessura} (m)`
                    : `altura × ${tipo.largura} × ${tipo.comprimento} (m)`}
                  {v > 0 && <span style={{ color: 'var(--gn)', fontWeight: 700 }}> = {v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³</span>}
                </div>
              </>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <Btn onClick={addLinha} size="sm">➕ Adicionar tipo</Btn>
        {total > 0 && (
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gn)' }}>
            📦 Total: {total.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³
          </div>
        )}
      </div>

      {/* ── Modal: cadastrar / listar tipos ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Tipos de Lâmina"
        footer={<>
          <Btn onClick={() => setModal(false)}>Fechar</Btn>
          <Btn onClick={salvarTipo} variant="primary" size="md" disabled={saving}>{saving ? 'Salvando...' : '+ Cadastrar'}</Btn>
        </>}>

        <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
          Novo tipo
        </div>

        <Input label="Nome do tipo *" value={novo.nome}
          onChange={(v: string) => setNovo((e: any) => ({ ...e, nome: v }))}
          placeholder="Ex: Capa 2,6 / Retalho grande" />

        <Select label="Categoria *" value={novo.categoria || 'capa'}
          onChange={(v: string) => setNovo((e: any) => ({ ...e, categoria: v }))}
          options={CATEGORIAS} />

        <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
          Dimensões em METROS
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Largura (m) *" value={novo.largura}
            onChange={(v: string) => setNovo((e: any) => ({ ...e, largura: v }))} type="number" placeholder="Ex: 1.30" />
          <Input label="Comprimento (m) *" value={novo.comprimento}
            onChange={(v: string) => setNovo((e: any) => ({ ...e, comprimento: v }))} type="number" placeholder="Ex: 2.60" />
        </div>

        {usaFolhas(novo.categoria || 'capa') && (
          <>
            <Select label="Espessura *" value={novo.espessura || ''}
              onChange={(v: string) => setNovo((e: any) => ({ ...e, espessura: v }))}
              options={espOptions} />

            <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              Espessuras cadastradas (mm)
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ flex: 1 }}>
                <Input label="Nova espessura (mm)" value={novaEsp} onChange={setNovaEsp}
                  type="number" placeholder="Ex: 2,6" />
              </div>
              <div style={{ paddingTop: '18px' }}>
                <Btn onClick={salvarEspessura} size="sm">➕ Add</Btn>
              </div>
            </div>
            {espessuras.length > 0 && (
              <div className="flex flex-col gap-1" style={{ marginBottom: '6px' }}>
                {espessuras.map(e => (
                  <div key={e.id} className="flex justify-between items-center rounded-lg px-2 py-1"
                    style={{ background: 'var(--s1)', border: '1px solid var(--bd)', fontSize: '11px' }}>
                    <span style={{ color: 'var(--t1)' }}>{(e.valor_m * 1000).toLocaleString('pt-BR')} mm</span>
                    <Btn variant="danger" size="sm" onClick={() => removerEspessura(e.id)}>🗑</Btn>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', letterSpacing: '1px', margin: '10px 0 6px' }}>
          Cadastrados
        </div>
        {tipos.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>Nenhum tipo ainda.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {tipos.map(t => (
              <div key={t.id} className="flex justify-between items-center rounded-lg px-2 py-1"
                style={{ background: 'var(--s1)', border: '1px solid var(--bd)', fontSize: '11px' }}>
                <span style={{ color: 'var(--t1)' }}>
                  <b>{t.nome}</b> · {t.categoria} · {t.largura}×{t.comprimento}{t.espessura ? `×${(t.espessura * 1000).toLocaleString('pt-BR')}mm` : ''} m
                </span>
                <Btn variant="danger" size="sm" onClick={async () => {
                  const { error } = await supabase.from('tipos_lamina').update({ ativo: false }).eq('id', t.id)
                  if (error) { toast.error('Erro: ' + error.message); return }
                  toast.success('Removido')
                  setLinhas(ls => ls.map(l => l.tipoId === t.id ? { ...l, tipoId: '' } : l))
                  load()
                }}>🗑</Btn>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
