import { Capacitor, registerPlugin } from '@capacitor/core'

interface GuidePrinterPlugin { print(options: { title: string }): Promise<void> }
const GuidePrinter=registerPlugin<GuidePrinterPlugin>('GuidePrinter')

async function printCurrentDocument(title:string){
  const previous=document.title;document.title=title
  try{
    if(Capacitor.isNativePlatform())await GuidePrinter.print({title})
    else window.print()
  }finally{document.title=previous}
}

export async function printPublicGuide(title:string){await printCurrentDocument(title)}

export async function printExportDocument(title:string,html:string){
  const node=document.createElement('article')
  node.id='travel-planner-print-export'
  node.innerHTML=html
  document.body.append(node)
  document.body.classList.add('print-export-active')
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
  try{await printCurrentDocument(title)}finally{
    // Android's print adapter snapshots the WebView just after opening the system sheet.
    window.setTimeout(()=>{node.remove();document.body.classList.remove('print-export-active')},900)
  }
}
