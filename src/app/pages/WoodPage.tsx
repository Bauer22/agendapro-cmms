'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Modal, Input, Select, SH, Empty, KPI, Badge, Textarea, useConfirm } from '@/components/ui'
import { fmtD, td } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; can:(p:string)=>boolean }

const WOOD_CLASSES = ['12 a 18', '18 a 24', '24 a 35']

function maskPlate(v: string) {
  v = v.toUpperCase().replace(/[^A-Z0-9]/g,'')
  if (v.length > 7) v = v.slice(0,7)
  return v
}

export default function WoodPage({ profile, can }: Props) {
  const [entries, setEntries] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [view, setView] = useState<any>(null)
  const [editing, setEditing] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { confirm, dialog } = useConfirm()

  useEffect(() => { load(); loadSuppliers() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('wood_entries').select('*')
      .order('entry_date', { ascending: false })
      .order('arrival_time', { ascending: false })
      .limit(200)
    if (error) toast.error('Erro ao carregar: ' + error.message)
    setEntries(data || [])
    setLoading(false)
  }

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('id,name')
    setSuppliers(data || [])
  }

  function openNew() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2,'0')
    const mm = String(now.getMinutes()).padStart(2,'0')
    setEditing({
      entry_date: td(),
      arrival_time: `${hh}:${mm}`,
      wood_class: '18 a 24',
    })
    setModal(true)
  }

  async function save() {
    if (!editing.supplier_id)    { toast.error('Selecione o fornecedor'); return }
    if (!editing.wood_class)     { toast.error('Selecione a classe da madeira'); return }
    if (!editing.driver?.trim()) { toast.error('Informe o motorista'); return }
    if (!editing.plate?.trim())  { toast.error('Informe a placa'); return }
    if (!editing.weight_tons || parseFloat(editing.weight_tons) <= 0) { toast.error('Informe o peso em toneladas'); return }

    setSaving(true)

    const sup = suppliers.find(s => s.id === editing.supplier_id)
    const obj = {
      entry_date:    editing.entry_date || td(),
      arrival_time:  editing.arrival_time,
      supplier_id:   editing.supplier_id,
      supplier_name: sup?.name || '',
      wood_class:    editing.wood_class,
      driver:        editing.driver.trim(),
      plate:         editing.plate.trim().toUpperCase(),
      weight_tons:   parseFloat(editing.weight_tons),
      observation:   editing.observation || null,
      created_by:    profile?.display_name || profile?.email || '',
      created_by_id: profile?.id || null,
    }

    const { error } = editing.id
      ? await supabase.from('wood_entries').update({ ...obj, updated_by: profile?.display_name, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('wood_entries').insert(obj)

    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }

    // Audit trail
    await supabase.from('audit_trail').insert({
      table_name: 'wood_entries',
      record_id: editing.id || null,
      action: editing.id ? 'UPDATE' : 'INSERT',
      new_data: obj,
      user_id: profile?.id,
      user_name: profile?.display_name,
    }).then(() => {})

    toast.success(editing.id ? 'Registro atualizado ✅' : 'Entrada registrada ✅')
    setSaving(false)
    setModal(false)
    load()
  }

  async function del(id: string) {
    if (!await confirm('Excluir esta entrada?')) return
    const { error } = await supabase.from('wood_entries').delete().eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Excluído')
    load()
  }

  const totalTons = entries.slice(0, 30).reduce((s, e) => s + (parseFloat(e.weight_tons) || 0), 0)
  const totalEntries = entries.filter(e => e.entry_date === td()).length

  return (
    <div className="page-enter p-3">
      {dialog}
      <SH label="🪵 Entrada de Madeira" action={
        <Btn onClick={openNew} variant="primary" size="sm">+ Entrada</Btn>
      } />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <KPI num={`${totalTons.toFixed(1)} t`} label="Toneladas (30 últ.)" color="green" />
        <KPI num={totalEntries} label="Entradas hoje" color="orange" />
      </div>

      {loading ? <Empty icon="⏳" text="Carregando..." /> :
       entries.length === 0 ? <Empty icon="🪵" text="Nenhuma entrada registrada." /> : (
        <div className="flex flex-col gap-2">
          {entries.map(e => (
            <div key={e.id} onClick={() => setView(e)}
              className="rounded-xl p-3 cursor-pointer"
              style={{ background: 'var(--s1)', border: '1px solid var(--bd)' }}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="green">{e.wood_class || '—'}</Badge>
                    <span className="text-xs font-bold" style={{ color: 'var(--cy)' }}>
                      {parseFloat(e.weight_tons || 0).toFixed(3)} t
                    </span>
                  </div>
                  <div className="font-bold text-sm">{e.supplier_name || '—'}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--t2)' }}>
                    📅 {fmtD(e.entry_date)}{e.arrival_time ? ' às ' + e.arrival_time.slice(0,5) : ''}
                    {e.driver ? ' · 🚗 ' + e.driver : ''}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--t3)' }}>
                    🚛 {e.plate || '—'}{e.observation ? ' · ' + e.observation : ''}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Btn onClick={ev => { ev.stopPropagation(); setEditing(e); setModal(true) }} size="sm">✏️</Btn>
                  <Btn onClick={ev => { ev.stopPropagation(); del(e.id) }} variant="danger" size="sm">🗑</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detalhe */}
      <Modal open={!!view} onClose={() => setView(null)} title="Detalhe da Entrada">
        {view && (
          <div className="flex flex-col gap-2">
            {[
              ['Data', fmtD(view.entry_date)],
              ['Hora Chegada', view.arrival_time?.slice(0,5) || '—'],
              ['Fornecedor', view.supplier_name || '—'],
              ['Classe Madeira', view.wood_class || '—'],
              ['Motorista', view.driver || '—'],
              ['Placa', view.plate || '—'],
              ['Toneladas', `${parseFloat(view.weight_tons||0).toFixed(3)} t`],
              ['Observação', view.observation || '—'],
              ['Registrado por', view.created_by || '—'],
            ].map(([l,v],i) => (
              <div key={i} className="flex justify-between py-1.5 border-b" style={{ borderColor:'var(--bd)', fontSize:'12px' }}>
                <span style={{ color:'var(--t3)' }}>{l}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Formulário */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing.id ? 'Editar Entrada' : 'Nova Entrada de Madeira'}
        footer={
          <>
            <Btn onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save} variant="primary" size="md" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Btn>
          </>
        }>

        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Data *" value={editing.entry_date} onChange={(v:string) => setEditing((e:any) => ({...e, entry_date: v}))} type="date" />
          <Input label="Hora Chegada *" value={editing.arrival_time} onChange={(v:string) => setEditing((e:any) => ({...e, arrival_time: v}))} type="time" />
        </div>

        <Select label="Fornecedor *" value={editing.supplier_id || ''} onChange={(v:string) => setEditing((e:any) => ({...e, supplier_id: v}))}
          options={[{value:'',label:'Selecione o fornecedor...'}, ...suppliers.map(s => ({value: s.id, label: s.name}))]} />

        <Select label="Classe da Madeira *" value={editing.wood_class || '18 a 24'} onChange={(v:string) => setEditing((e:any) => ({...e, wood_class: v}))}
          options={WOOD_CLASSES} />

        <Input label="Motorista *" value={editing.driver} onChange={(v:string) => setEditing((e:any) => ({...e, driver: v}))} placeholder="Nome completo do motorista" />

        <Input label="Placa *" value={editing.plate} onChange={(v:string) => setEditing((e:any) => ({...e, plate: maskPlate(v)}))} placeholder="AAA0A00 ou AAA0000" />

        <Input label="Toneladas *" value={editing.weight_tons} onChange={(v:string) => setEditing((e:any) => ({...e, weight_tons: v}))} type="number" placeholder="0.000" />

        <Textarea label="Observação (ticket de peso, anotações)" value={editing.observation} onChange={(v:string) => setEditing((e:any) => ({...e, observation: v}))} rows={2} placeholder="Opcional..." />
      </Modal>
    </div>
  )
}
