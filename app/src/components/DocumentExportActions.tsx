import { useState } from 'react'
import { FileDown, FileText, Printer } from 'lucide-react'
import { exportTableAsPdf, exportTableAsWord, type ExportTable } from '../utils/exportDocuments'

export function DocumentExportActions({table}:{table:ExportTable}){
  const [format,setFormat]=useState<'pdf'|'word'|null>(null)
  const run=async(next:'pdf'|'word')=>{
    setFormat(next)
    try{if(next==='pdf')await exportTableAsPdf(table);else await exportTableAsWord(table)}
    finally{setFormat(null)}
  }
  return <div className="export-actions mb-6 flex flex-col gap-3 rounded-2xl border border-skysoft-100 bg-skysoft-50/65 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0"><p className="flex items-center gap-2 text-sm font-bold text-stone-700"><FileDown size={17} className="text-skysoft-500"/>导出当前清单</p><p className="mt-1 text-xs leading-5 text-stone-500">PDF 会打开系统打印服务，请选择“保存为 PDF”；Word 会直接下载或唤起分享。</p></div>
    <div className="flex shrink-0 flex-wrap gap-2"><button type="button" className="secondary-btn" disabled={format!==null} onClick={()=>void run('pdf')}><Printer size={16}/>{format==='pdf'?'正在准备…':'导出 PDF'}</button><button type="button" className="primary-btn" disabled={format!==null} onClick={()=>void run('word')}><FileText size={16}/>{format==='word'?'正在生成…':'导出 Word'}</button></div>
  </div>
}
