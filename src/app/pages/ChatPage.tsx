'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Empty } from '@/components/ui'
import toast from 'react-hot-toast'
import type { UserProfile } from '@/types'

interface Props { profile: UserProfile|null }
interface Msg {
  id: string; company_id: string; sender_id: string; sender_name: string;
  content: string; created_at: string;
}

export default function ChatPage({ profile }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
    loadUsers()
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const m = payload.new as Msg
        if (m.company_id === profile?.company_id) {
          setMessages(prev => [...prev, m])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function load() {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) toast.error('Erro ao carregar mensagens: ' + error.message)
    setMessages(data || [])
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('id,display_name,email,role')
    setUsers(data || [])
  }

  async function send() {
    const content = text.trim()
    if (!content) return
    setText('')
    const { error } = await supabase.from('chat_messages').insert({
      sender_id: profile?.id,
      sender_name: profile?.display_name || profile?.email,
      content,
    })
    if (error) toast.error('Erro ao enviar: ' + error.message)
  }

  function resolveSenderName(m: Msg) {
    if (m.sender_name) return m.sender_name
    const u = users.find(x => x.id === m.sender_id)
    return u?.display_name || u?.email?.split('@')[0] || 'Usuário'
  }

  function initials(name: string) {
    return (name || '?').trim().split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
  }

  function avatarColor(id: string) {
    const colors = ['#f97316','#3b82f6','#22c55e','#a78bfa','#eab308','#ef4444','#06b6d4']
    let hash = 0
    for (let i=0;i<id.length;i++) hash = id.charCodeAt(i) + ((hash<<5)-hash)
    return colors[Math.abs(hash) % colors.length]
  }

  function fmtTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function fmtDateSep(iso: string) {
    const d = new Date(iso)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) return 'Hoje'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  }

  // Group messages by date for separators
  const grouped: { date: string; msgs: Msg[] }[] = []
  messages.forEach(m => {
    const dateKey = new Date(m.created_at).toDateString()
    const last = grouped[grouped.length - 1]
    if (last && last.date === dateKey) last.msgs.push(m)
    else grouped.push({ date: dateKey, msgs: [m] })
  })

  return (
    <div className="page-enter flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-2xl spin">⚙️</div>
          </div>
        ) : messages.length === 0 ? (
          <Empty icon="💬" text="Nenhuma mensagem ainda. Seja o primeiro a escrever!" />
        ) : (
          <>
            {grouped.map((g, gi) => (
              <div key={gi}>
                <div className="flex items-center justify-center my-3">
                  <div style={{fontSize:'10px',color:'var(--t3)',background:'var(--s1)',padding:'3px 12px',borderRadius:'20px',border:'1px solid var(--bd)'}}>
                    {fmtDateSep(g.msgs[0].created_at)}
                  </div>
                </div>
                {g.msgs.map(m => {
                  const mine = m.sender_id === profile?.id
                  return (
                    <div key={m.id} className={`flex items-end gap-2 mb-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                      <div style={{width:'26px',height:'26px',borderRadius:'50%',background:avatarColor(m.sender_id),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0}}>
                        {initials(resolveSenderName(m))}
                      </div>
                      <div style={{maxWidth:'74%'}}>
                        <div style={{fontSize:'9px',color: mine ? 'rgba(249,115,22,.7)' : 'var(--t3)',marginBottom:'2px',marginLeft: mine?0:'2px',marginRight: mine?'2px':0,textAlign: mine?'right':'left'}}>{mine ? 'Você' : resolveSenderName(m)}</div>
                        <div style={{
                          background: mine ? 'linear-gradient(135deg,#f97316,#c85a00)' : 'var(--s1)',
                          color: mine ? '#fff' : 'var(--t1)',
                          border: mine ? 'none' : '1px solid var(--bd)',
                          borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                        }}>
                          {m.content}
                        </div>
                        <div style={{fontSize:'8px',color:'var(--t3)',marginTop:'2px',textAlign: mine ? 'right':'left',marginRight: mine?'2px':0,marginLeft: mine?0:'2px'}}>
                          {fmtTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-3 py-2.5 flex items-center gap-2" style={{borderTop:'1px solid var(--bd)',background:'var(--bg2)',paddingBottom:'calc(10px + var(--sab))'}}>
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Digite uma mensagem..."
          style={{flex:1,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'22px',padding:'10px 16px',color:'var(--t1)',fontFamily:"'Sora',system-ui",fontSize:'13px',outline:'none'}}
        />
        <button onClick={send} disabled={!text.trim()}
          style={{width:'40px',height:'40px',borderRadius:'50%',border:'none',background: text.trim() ? 'linear-gradient(135deg,#f97316,#c85a00)' : 'var(--s2)',color:'#fff',cursor: text.trim()?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'16px',boxShadow: text.trim() ? '0 3px 12px rgba(249,115,22,.4)' : 'none'}}>
          ➤
        </button>
      </div>
    </div>
  )
}
