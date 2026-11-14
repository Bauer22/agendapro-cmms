'use client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtD, fmtDT } from './utils'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────
// LOGO DA EMPRESA NOS RELATÓRIOS
// A logo é salva como base64 (data URL) no system_config:
//   categoria='empresa', chave='logo_base64'.
// Carregada 1x e guardada em cache nesta sessão.
// ─────────────────────────────────────────────────────────────
let _logoCache: string | null | undefined = undefined  // undefined = não buscado; null = não existe

export async function loadCompanyLogo(): Promise<string | null> {
  if (_logoCache !== undefined) return _logoCache
  try {
    // limit(1) em vez de maybeSingle(): maybeSingle() ERRA se houver linhas
    // duplicadas da logo, deixando o PDF sem logo mesmo ela estando salva.
    const { data } = await supabase.from('system_config')
      .select('valor_texto,valor').eq('categoria','empresa').eq('chave','logo_base64')
      .order('atualizado_em', { ascending: false, nullsFirst: false }).limit(1)
    const row: any = Array.isArray(data) ? data[0] : null
    const v: any = row ? (row.valor_texto ?? row.valor) : null
    _logoCache = (typeof v === 'string' && v.startsWith('data:image')) ? v : null
  } catch { _logoCache = null }
  return _logoCache
}

// invalida o cache (chamar após salvar/remover a logo nas Configurações)
export function clearLogoCache() { _logoCache = undefined }

// formato jsPDF a partir do data URL
function logoFormat(dataUrl: string): 'PNG'|'JPEG' {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG'
}

/**
 * Desenha a logo da empresa no CANTO SUPERIOR DIREITO do PDF (se houver).
 * Não colide com o título/subtítulo (que ficam à esquerda).
 * Chame com `await` logo após criar o doc:  await addReportLogo(doc)
 */
// mede a imagem (largura/altura) de forma confiável pelo navegador
function medirImagem(dataUrl: string): Promise<{w:number;h:number}> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth || 200, h: img.naturalHeight || 100 })
      img.onerror = () => resolve({ w: 200, h: 100 })
      img.src = dataUrl
    } catch { resolve({ w: 200, h: 100 }) }
  })
}

export async function addReportLogo(doc: jsPDF, opts: { y?:number; maxW?:number; maxH?:number; margin?:number } = {}): Promise<void> {
  const logo = await loadCompanyLogo()
  if (!logo) return
  const y = opts.y ?? 6, maxH = opts.maxH ?? 16, maxW = opts.maxW ?? 40, margin = opts.margin ?? 10
  const pageW = doc.internal.pageSize.getWidth()

  // 1) tenta medir pela propriedade do jsPDF; se falhar, mede pelo navegador
  let pw = 0, ph = 0
  try {
    const props = (doc as any).getImageProperties(logo)
    pw = props?.width || 0; ph = props?.height || 0
  } catch { /* segue para o fallback */ }
  if (!pw || !ph) {
    const m = await medirImagem(logo)
    pw = m.w; ph = m.h
  }

  const ratio = (pw && ph) ? (pw / ph) : 2
  let h = maxH, w = h * ratio
  if (w > maxW) { w = maxW; h = w / ratio }

  try {
    doc.addImage(logo, logoFormat(logo), pageW - margin - w, y, w, h)
  } catch (e) {
    // última tentativa: desenha com dimensões fixas
    try {
      doc.addImage(logo, logoFormat(logo), pageW - margin - maxW, y, maxW, maxH)
    } catch (e2) {
      if (typeof console !== 'undefined') console.error('Falha ao desenhar logo no PDF:', e2)
    }
  }
}

interface PDFOptions { title: string; company?: string; logo?: string; user?: string }

function header(doc: jsPDF, opts: PDFOptions) {
  const { title, company = 'Industrial8', user = '' } = opts
  doc.setFillColor(6,13,26)
  doc.rect(0,0,210,28,'F')
  doc.setTextColor(0,212,255)
  doc.setFontSize(16); doc.setFont('helvetica','bold')
  doc.text('Industrial8', 12, 12)
  doc.setTextColor(148,163,184); doc.setFontSize(9); doc.setFont('helvetica','normal')
  doc.text(company, 12, 19)
  const now = new Date()
  doc.text(`${fmtDT(now.toISOString())} · ${user}`, 210-12, 19, {align:'right'})
  doc.setTextColor(30,58,95); doc.setFontSize(13); doc.setFont('helvetica','bold')
  doc.setTextColor(226,232,240)
  doc.text(title, 12, 40)
  doc.setDrawColor(0,212,255); doc.setLineWidth(0.5)
  doc.line(12, 43, 198, 43)
}

export async function pdfOS(orders: any[], opts: PDFOptions) {
  const doc = new jsPDF()
  header(doc, opts)
  autoTable(doc, {
    startY: 48,
    head: [['Nº OS','Título','Máquina','Responsável','Status','Abertura','Prazo','Prioridade']],
    body: orders.map(o => [o.number||'—',o.title||'—',o.machine_name||'—',o.resp_name||'—',o.status||'—',fmtD(o.open_date),fmtD(o.due_date),o.priority||'—']),
    styles: { fontSize:8, cellPadding:3 },
    headStyles: { fillColor:[6,13,26], textColor:[0,212,255], fontStyle:'bold' },
    alternateRowStyles: { fillColor:[241,245,249] },
  })
  doc.save(`OS_${fmtD(new Date().toISOString().split('T')[0])}.pdf`)
}

export async function pdfMaint(recs: any[], opts: PDFOptions) {
  const doc = new jsPDF()
  header(doc, opts)
  autoTable(doc, {
    startY: 48,
    head: [['Data','Máquina','Tipo','Responsável','Duração','Resultado']],
    body: recs.map(r => [fmtD(r.date),r.machine_name||'—',r.type||'—',r.resp||'—',r.duration?r.duration+'h':'—',r.result||'—']),
    styles: { fontSize:8, cellPadding:3 },
    headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
    alternateRowStyles: { fillColor:[241,245,249] },
  })
  doc.save(`Manutencao_${fmtD(new Date().toISOString().split('T')[0])}.pdf`)
}

export async function pdfParts(parts: any[], opts: PDFOptions) {
  const doc = new jsPDF()
  header(doc, opts)
  autoTable(doc, {
    startY: 48,
    head: [['Código','Nome','Categoria','Estoque','Mínimo','Valor Unit.','Localização']],
    body: parts.map(p => [p.code||'—',p.name||'—',p.category||'—',`${p.stock} ${p.unit}`,p.min_stock,p.unit_value?`R$ ${p.unit_value}`:'—',p.location||'—']),
    styles: { fontSize:8, cellPadding:3 },
    headStyles: { fillColor:[6,13,26], textColor:[0,212,255] },
    alternateRowStyles: { fillColor:[241,245,249] },
  })
  doc.save(`Pecas_${fmtD(new Date().toISOString().split('T')[0])}.pdf`)
}
