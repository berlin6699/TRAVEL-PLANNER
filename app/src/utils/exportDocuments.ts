import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { printExportDocument } from './printGuide'

export type ExportColumn = { label: string }
export type ExportTable = { title: string; description: string; columns: ExportColumn[]; rows: string[][] }

function escapeHtml(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function safeName(value:string){return value.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').slice(0,80)||'travel-planner-export'}

function renderPrintTable(table:ExportTable){
  const head=table.columns.map(column=>`<th>${escapeHtml(column.label)}</th>`).join('')
  const rows=table.rows.length?table.rows.map(row=>`<tr>${table.columns.map((_,index)=>`<td>${escapeHtml(row[index]||'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${table.columns.length}" class="empty">暂无记录</td></tr>`
  return `<section class="export-sheet"><header><p>TRAVEL PLANNER</p><h1>${escapeHtml(table.title)}</h1><div>${escapeHtml(table.description)} · 导出于 ${new Date().toLocaleString('zh-CN')}</div></header><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table><footer>由“旅途 Travel Planner”生成</footer></section>`
}

async function saveBlob(blob:Blob,filename:string,title:string){
  if(Capacitor.isNativePlatform()){
    const bytes=new Uint8Array(await blob.arrayBuffer());let binary=''
    for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000))
    const file=await Filesystem.writeFile({path:filename,data:btoa(binary),directory:Directory.Cache})
    await Share.share({title,url:file.uri,dialogTitle:`保存或分享${title}`})
    return
  }
  const url=URL.createObjectURL(blob),link=document.createElement('a')
  link.href=url;link.download=filename;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}

const cellBorder={style:BorderStyle.SINGLE,size:4,color:'E7E5E4'}
function wordCell(text:string,header=false){
  return new TableCell({
    shading:header?{fill:'FF7A61'}:undefined,
    borders:{top:cellBorder,bottom:cellBorder,left:cellBorder,right:cellBorder},
    margins:{top:110,bottom:110,left:130,right:130},
    children:[new Paragraph({children:[new TextRun({text:text||'—',bold:header,color:header?'FFFFFF':'292524',size:19})]})],
  })
}

export async function exportTableAsPdf(table:ExportTable){
  await printExportDocument(table.title,renderPrintTable(table))
}

export async function exportTableAsWord(table:ExportTable){
  const tableRows=[
    new TableRow({tableHeader:true,children:table.columns.map(column=>wordCell(column.label,true))}),
    ...(table.rows.length?table.rows.map(row=>new TableRow({children:table.columns.map((_,index)=>wordCell(row[index]||'—'))})):[new TableRow({children:table.columns.map((_,index)=>wordCell(index===0?'暂无记录':''))})]),
  ]
  const document=new Document({
    creator:'旅途 Travel Planner',
    title:table.title,
    sections:[{properties:{page:{margin:{top:720,right:720,bottom:720,left:720}}},children:[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:120},children:[new TextRun({text:table.title,bold:true,size:34,color:'D95A45'})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:300},children:[new TextRun({text:`${table.description} · 导出于 ${new Date().toLocaleString('zh-CN')}`,size:19,color:'78716C'})]}),
      new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:tableRows}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:240},children:[new TextRun({text:'由“旅途 Travel Planner”生成',size:17,color:'A8A29E'})]}),
    ]}],
  })
  const blob=await Packer.toBlob(document)
  await saveBlob(blob,`${safeName(table.title)}.docx`,'Word 文档')
}
