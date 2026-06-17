'use client'
import { useState, useEffect, useRef } from 'react'

// ── Gear icon, reused from login/header for brand consistency ──
function Gear({ size = 52, spin = 8, reverse = false }: { size?: number; spin?: number; reverse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      <g style={{ transformOrigin: '26px 26px', animation: `lpGearSpin ${spin}s linear infinite${reverse ? ' reverse' : ''}` }}>
        <path d="M22 1h8l1.5 5.5a18 18 0 0 1 4.5 1.8l5-2.8 5.7 5.7-2.8 5a18 18 0 0 1 1.8 4.5L51 22v8l-5.5 1.5a18 18 0 0 1-1.8 4.5l2.8 5-5.7 5.7-5-2.8a18 18 0 0 1-4.5 1.8L30 51h-8l-1.5-5.5a18 18 0 0 1-4.5-1.8l-5 2.8-5.7-5.7 2.8-5a18 18 0 0 1-1.8-4.5L1 30v-8l5.5-1.5a18 18 0 0 1 1.8-4.5l-2.8-5 5.7-5.7 5 2.8a18 18 0 0 1 4.5-1.8L22 1z" fill="#1e3a6e" stroke="#f97316" strokeWidth="1.3" />
      </g>
      <circle cx="26" cy="26" r="9" fill="#06101e" stroke="#f97316" strokeWidth="1.5" />
      <circle cx="26" cy="26" r="2.8" fill="#f97316" />
    </svg>
  )
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity .7s ease ${delay}ms, transform .7s cubic-bezier(.2,.8,.2,1) ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

const MODULES = [
  { icon: '🏠', title: 'Dashboard', desc: 'KPIs em tempo real, MTBF/MTTR, Pareto de falhas e calendário de ordens — tudo em uma tela.' },
  { icon: '📋', title: 'Ordens de Serviço', desc: 'Kanban visual, regra de Fim de Semana e baixa automática de peças no estoque ao fechar a OS.' },
  { icon: '⚙️', title: 'Máquinas', desc: 'Cadastro completo com componentes, plano de manutenção e controle de horímetro.' },
  { icon: '📝', title: 'Manutenção Preventiva', desc: 'Planos por período, consertos externos com rastreio de fornecedor e custo.' },
  { icon: '✅', title: 'Tarefas', desc: 'Calendário diário com prioridade e responsável definidos por máquina ou setor.' },
  { icon: '📦', title: 'Peças e Estoque', desc: 'Controle por categoria, pedidos de compra e histórico completo de movimentações.' },
  { icon: '🏭', title: 'Fornecedores', desc: 'Cadastro com contato direto via WhatsApp e telefone.' },
  { icon: '📊', title: 'Relatórios', desc: 'PDF filtrado por data, máquina ou operador, e backup completo dos dados em JSON.' },
  { icon: '📱', title: 'QR Code', desc: 'Etiqueta gerada e impressa por máquina — escaneie e acesse o histórico na hora.' },
  { icon: '⏱️', title: 'Paradas', desc: 'Registro de downtime com cálculo automático de MTBF/MTTR e Pareto de causas.' },
  { icon: '💰', title: 'Financeiro', desc: 'Contas a pagar e centros de custo vinculados à manutenção.' },
  { icon: '👥', title: 'Multi-empresa (SaaS)', desc: 'Um sistema, várias empresas isoladas — com painel próprio para gestão de planos.' },
]

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [demoTab, setDemoTab] = useState<'dashboard' | 'os' | 'qr'>('dashboard')
  const [form, setForm] = useState({ name: '', company: '', phone: '', message: '' })
  const [sent, setSent] = useState(false)

  function submitContact(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone) return
    const text = encodeURIComponent(
      `Olá! Tenho interesse no Industrial8.\nNome: ${form.name}\nEmpresa: ${form.company || '-'}\nTelefone: ${form.phone}\nMensagem: ${form.message || '-'}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
    setSent(true)
  }

  return (
    <>
      <style>{`
        @keyframes lpGearSpin { to { transform: rotate(360deg) } }
        @keyframes lpPulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes lpFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .lp-btn-primary:hover { box-shadow: 0 10px 36px rgba(249,115,22,.6) !important; transform: translateY(-2px); }
        .lp-btn-ghost:hover { background: rgba(249,115,22,.1) !important; border-color: rgba(249,115,22,.4) !important; }
        .lp-card:hover { border-color: rgba(249,115,22,.4) !important; transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,.35); }
        .lp-tab { cursor: pointer; transition: all .2s; }
        ::selection { background: rgba(249,115,22,.3); }
      `}</style>

      <div style={{ background: '#06101e', color: '#e8edf5', fontFamily: "'Sora',system-ui,sans-serif", overflowX: 'hidden' }}>

        {/* ══════════ NAV ══════════ */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(249,115,22,.15)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Gear size={32} />
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-.3px' }}>industrial<span style={{ color: '#f97316' }}>8</span></span>
            </div>
            <button onClick={onEnter} className="lp-btn-ghost" style={{ background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.25)', color: '#f97316', borderRadius: '10px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, fontFamily: "'Sora',system-ui", cursor: 'pointer', transition: 'all .2s' }}>
              Entrar →
            </button>
          </div>
        </nav>

        {/* ══════════ HERO ══════════ */}
        <section style={{ position: 'relative', padding: '70px 20px 60px', textAlign: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(249,115,22,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,.025) 1px,transparent 1px)', backgroundSize: '46px 46px' }} />
          <div style={{ position: 'absolute', top: '0%', left: '50%', transform: 'translateX(-50%)', width: '70vw', maxWidth: '700px', height: '380px', borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(249,115,22,.13),transparent 65%)', animation: 'lpPulse 5s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '8%', right: '6%', opacity: .12 }}><Gear size={120} spin={20} reverse /></div>
          <div style={{ position: 'absolute', bottom: '4%', left: '4%', opacity: .1 }}><Gear size={90} spin={16} /></div>

          <div style={{ position: 'relative', maxWidth: '760px', margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.25)', borderRadius: '20px', padding: '5px 14px', fontSize: '11px', fontWeight: 700, color: '#fb923c', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: '22px' }}>
              ⚙️ Sistema de Manutenção Industrial
            </div>
            <h1 style={{ fontSize: 'clamp(32px,6vw,52px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-1px', margin: '0 0 18px' }}>
              Sua manutenção industrial,<br />
              <span style={{ color: '#f97316' }}>organizada em um só lugar</span>
            </h1>
            <p style={{ fontSize: 'clamp(14px,2vw,17px)', color: '#8fa3bf', lineHeight: 1.6, maxWidth: '560px', margin: '0 auto 32px' }}>
              Ordens de serviço, preventivas, estoque de peças, MTBF/MTTR e relatórios — tudo
              integrado, com QR Code por máquina e acesso multiempresa em nuvem.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={onEnter} className="lp-btn-primary" style={{ background: 'linear-gradient(135deg,#f97316,#c85a00)', color: '#fff', border: 'none', borderRadius: '12px', padding: '13px 28px', fontSize: '14px', fontWeight: 700, fontFamily: "'Sora',system-ui", cursor: 'pointer', boxShadow: '0 6px 24px rgba(249,115,22,.45)', transition: 'all .2s' }}>
                ▶ Acessar o Sistema
              </button>
              <a href="#contato" className="lp-btn-ghost" style={{ background: 'transparent', color: '#e8edf5', border: '1px solid rgba(255,255,255,.15)', borderRadius: '12px', padding: '13px 28px', fontSize: '14px', fontWeight: 700, fontFamily: "'Sora',system-ui", cursor: 'pointer', transition: 'all .2s', textDecoration: 'none', display: 'inline-block' }}>
                Falar com a equipe
              </a>
            </div>
          </div>
        </section>

        {/* ══════════ DEMO INTERATIVA ══════════ */}
        <section style={{ padding: '20px 20px 70px', maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: 'clamp(22px,3.5vw,30px)', fontWeight: 800, marginBottom: '8px' }}>Veja o sistema por dentro</h2>
              <p style={{ color: '#8fa3bf', fontSize: '14px' }}>Navegue pelas telas reais antes mesmo de entrar</p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { id: 'dashboard', label: '🏠 Dashboard' },
                { id: 'os', label: '📋 Ordens de Serviço' },
                { id: 'qr', label: '📱 QR Code' },
              ].map(t => (
                <div key={t.id} onClick={() => setDemoTab(t.id as any)} className="lp-tab" style={{
                  padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                  background: demoTab === t.id ? 'rgba(249,115,22,.12)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${demoTab === t.id ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.08)'}`,
                  color: demoTab === t.id ? '#fb923c' : '#8fa3bf',
                }}>
                  {t.label}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div style={{ background: '#0c1a30', border: '1px solid rgba(249,115,22,.2)', borderRadius: '20px', padding: '4px', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div style={{ background: '#0a1626', borderRadius: '16px', padding: '24px', minHeight: '320px' }}>
                {demoTab === 'dashboard' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: '10px', marginBottom: '18px' }}>
                      {[['24', 'OS Abertas', '#3b82f6'], ['98%', 'Disponib.', '#22c55e'], ['4.2h', 'MTTR', '#f59e0b'], ['312h', 'MTBF', '#a78bfa']].map(([n, l, c], i) => (
                        <div key={i} style={{ background: '#102038', border: '1px solid rgba(249,115,22,.12)', borderTop: `2px solid ${c}`, borderRadius: '12px', padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '24px', color: c }}>{n}</div>
                          <div style={{ fontSize: '8px', color: '#4a6380', textTransform: 'uppercase', letterSpacing: '.5px' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#8fa3bf', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>📊 Pareto de Falhas</div>
                    {[['Motor elétrico', 85], ['Rolamento', 60], ['Correia', 38], ['Sensor', 18]].map(([n, w], i) => (
                      <div key={i} style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}><span>{n}</span><span style={{ color: '#4a6380' }}>{w}%</span></div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${w}%`, background: 'linear-gradient(90deg,#f97316,#fb923c)', borderRadius: '3px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {demoTab === 'os' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px' }}>
                    {[
                      { st: 'Aberta', c: '#3b82f6', items: ['Troca de óleo — Torno 02', 'Vazamento hidráulico'] },
                      { st: 'Andamento', c: '#f59e0b', items: ['Motor superaquecendo'] },
                      { st: 'Concluída', c: '#22c55e', items: ['Calibração sensor', 'Lubrificação correntes'] },
                    ].map((col, i) => (
                      <div key={i}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: col.c, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: col.c }} /> {col.st}
                        </div>
                        {col.items.map((it, j) => (
                          <div key={j} style={{ background: '#102038', border: '1px solid rgba(255,255,255,.06)', borderRadius: '10px', padding: '10px', marginBottom: '8px', fontSize: '11px' }}>
                            {it}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {demoTab === 'qr' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px' }}>
                    <div style={{ width: '120px', height: '120px', background: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '52px' }}>▦</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>Torno Laminador 02</div>
                      <div style={{ fontSize: '10px', color: '#4a6380', marginTop: '2px' }}>Escaneie para abrir OS, ver histórico e checklist</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ══════════ MÓDULOS ══════════ */}
        <section style={{ padding: '20px 20px 70px', maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <h2 style={{ fontSize: 'clamp(22px,3.5vw,30px)', fontWeight: 800, marginBottom: '8px' }}>12 módulos, um sistema só</h2>
              <p style={{ color: '#8fa3bf', fontSize: '14px' }}>Tudo o que sua equipe de manutenção precisa, sem planilhas soltas</p>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '14px' }}>
            {MODULES.map((m, i) => (
              <Reveal key={i} delay={Math.min(i * 40, 300)}>
                <div className="lp-card" style={{ background: '#0c1a30', border: '1px solid rgba(255,255,255,.06)', borderRadius: '16px', padding: '20px', height: '100%', transition: 'all .2s' }}>
                  <div style={{ fontSize: '26px', marginBottom: '10px' }}>{m.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>{m.title}</div>
                  <div style={{ fontSize: '12px', color: '#8fa3bf', lineHeight: 1.5 }}>{m.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ══════════ CONTATO ══════════ */}
        <section id="contato" style={{ padding: '20px 20px 90px', maxWidth: '560px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: 'clamp(22px,3.5vw,30px)', fontWeight: 800, marginBottom: '8px' }}>Interessado para sua empresa?</h2>
              <p style={{ color: '#8fa3bf', fontSize: '14px' }}>Deixe seus dados e entramos em contato com uma demonstração</p>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div style={{ background: '#0c1a30', border: '1px solid rgba(249,115,22,.2)', borderRadius: '18px', padding: '26px' }}>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>✅</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Mensagem pronta!</div>
                  <div style={{ fontSize: '12px', color: '#8fa3bf' }}>Abrimos o WhatsApp para você concluir o envio.</div>
                </div>
              ) : (
                <form onSubmit={submitContact}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, letterSpacing: '1.2px', color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', marginBottom: '4px' }}>Nome *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={inputStyle} placeholder="Seu nome" />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, letterSpacing: '1.2px', color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', marginBottom: '4px' }}>Empresa</label>
                    <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} style={inputStyle} placeholder="Nome da empresa" />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, letterSpacing: '1.2px', color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', marginBottom: '4px' }}>Telefone / WhatsApp *</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required type="tel" style={inputStyle} placeholder="(00) 00000-0000" />
                  </div>
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, letterSpacing: '1.2px', color: 'rgba(249,115,22,.65)', textTransform: 'uppercase', marginBottom: '4px' }}>Mensagem</label>
                    <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Conte um pouco sobre sua operação..." />
                  </div>
                  <button type="submit" className="lp-btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg,#f97316,#c85a00)', color: '#fff', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '13px', fontWeight: 700, fontFamily: "'Sora',system-ui", cursor: 'pointer', boxShadow: '0 5px 20px rgba(249,115,22,.4)', transition: 'all .2s' }}>
                    💬 Enviar via WhatsApp
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </section>

        {/* ══════════ FOOTER ══════════ */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <Gear size={20} spin={10} />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>industrial<span style={{ color: '#f97316' }}>8</span></span>
          </div>
          <div style={{ fontSize: '10px', color: '#4a6380' }}>Manutenção Industrial Inteligente</div>
        </footer>
      </div>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(249,115,22,.04)', border: '1px solid rgba(249,115,22,.18)',
  borderRadius: '10px', padding: '10px 13px', color: '#e8edf5', fontFamily: "'Sora',system-ui",
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}
