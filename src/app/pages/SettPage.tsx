'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Input, SH } from '@/components/ui'
import { ROLES } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null; onSave:(p:UserProfile)=>void }

export default function SettPage({ profile, onSave }: Props) {
  const [name, setName]   = useState(profile?.display_name||'')
  const [shift, setShift] = useState(profile?.shift||'')
  const [coName, setCoName] = useState('')
  const [coSector, setCoSector] = useState('')

  useEffect(() => {
    supabase.from('config').select('*').eq('id','company').single().then(({data}) => {
      if (data) { setCoName(data.name||''); setCoSector(data.sector||'') }
    })
  }, [])

  async function saveProfile() {
    if (!name.trim()) { toast.error('Informe o nome'); return }
    try {
      const { error } = await supabase.from('profiles').update({ display_name: name, shift }).eq('id', profile?.id)
      if (error) throw error
      onSave({ ...profile!, display_name: name, shift })
      toast.success('Perfil atualizado ✅')
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  async function saveCompany() {
    try {
      await supabase.from('config').upsert({ id:'company', name: coName, sector: coSector, updated_at: new Date().toISOString() })
      toast.success('Empresa atualizada ✅')
    } catch(e:any) { toast.error('Erro: '+e.message) }
  }

  return (
    <div>
      {/* Company */}
      <SH label="🏭 Empresa" />
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        <Input label="Nome da Empresa" value={coName} onChange={setCoName} placeholder="Ex: Laminadora ABC Ltda." />
        <Input label="Setor / Unidade" value={coSector} onChange={setCoSector} placeholder="Ex: Produção — Turno A" />
        <Btn onClick={saveCompany} variant="secondary" size="md">Salvar Empresa</Btn>
      </div>

      {/* Profile */}
      <SH label="👤 Minha Conta" />
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        <div className="text-xs mb-2" style={{color:'var(--t2)'}}>{profile?.email}</div>
        <div className="text-xs mb-3 px-2 py-1 rounded-lg inline-block" style={{background:'rgba(0,212,255,.1)',color:'var(--cy)',fontSize:'11px',fontWeight:700}}>{ROLES[profile?.role||'viewer']?.label}</div>
        <Input label="Nome de Exibição" value={name} onChange={setName} placeholder="Seu nome" />
        <Input label="Turno" value={shift} onChange={setShift} placeholder="Ex: A" />
        <Btn onClick={saveProfile} variant="primary" size="md">Salvar Perfil</Btn>
      </div>

      {/* Install */}
      <SH label="📱 Instalar no Celular" />
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        {[
          { tag:'iOS', color:'var(--cy)', bg:'rgba(0,212,255,.15)', text:'Safari → Compartilhar → "Adicionar à Tela de Início" → Adicionar ✅' },
          { tag:'AND', color:'#000', bg:'var(--gn)', text:'Chrome → Menu ⋮ → "Adicionar à tela inicial" → Instalar ✅' },
        ].map(s => (
          <div key={s.tag} className="flex gap-2 items-start mb-2">
            <div className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 mt-0.5" style={{background:s.bg,color:s.color}}>{s.tag}</div>
            <div className="text-xs leading-relaxed" style={{color:'var(--t2)'}} dangerouslySetInnerHTML={{__html:s.text.replace(/"/g,'<strong style="color:var(--t1)">').replace(/(→\s*"[^"]+")/, (m)=>m.replace(/"/g,'</strong>').replace(/(")/,'<strong style="color:var(--t1)">')+'"</strong>')}} />
          </div>
        ))}
      </div>

      {/* Supabase setup */}
      <SH label="⚡ Configuração Supabase" />
      <div className="rounded-xl p-3 mb-3" style={{background:'var(--s1)',border:'1px solid var(--bd)'}}>
        <div className="text-xs font-bold mb-2" style={{color:'var(--cy)'}}>Executar no SQL Editor do Supabase:</div>
        <div className="text-xs font-mono p-2 rounded-lg overflow-x-auto" style={{background:'var(--bg)',color:'var(--gn)',fontSize:'10px',lineHeight:1.6}}>
          {`-- Execute o script SQL disponível em:\n-- supabase-schema.sql`}
        </div>
      </div>

      <div className="text-center py-4 text-xs" style={{color:'var(--t3)'}}>AgendaPro CMMS v3.0 · Supabase · Vercel · PWA</div>
    </div>
  )
}
