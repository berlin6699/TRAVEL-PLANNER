import { Capacitor, registerPlugin } from '@capacitor/core'

interface GuidePrinterPlugin { print(options: { title: string }): Promise<void> }
const GuidePrinter=registerPlugin<GuidePrinterPlugin>('GuidePrinter')

export async function printPublicGuide(title:string){
  const previous=document.title;document.title=title
  try{
    if(Capacitor.isNativePlatform())await GuidePrinter.print({title})
    else window.print()
  }finally{document.title=previous}
}
