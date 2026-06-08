'use client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtD, fmtDT } from './utils'

interface PDFOptions { title: string; company?: string; logo?: string; user?: string }

function header(doc: jsPDF, opts: PDFOptions) {
  const { title, company = 'AgendaPro CMMS', user = '' } = opts
  doc.setFillColor(6,13,26)
  doc.rect(0,0,210,28,'F')
  doc.setTextColor(0,212,255)
  doc.setFontSize(16); doc.setFont('helvetica','bold')
  doc.text('AgendaPro CMMS', 12, 12)
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
