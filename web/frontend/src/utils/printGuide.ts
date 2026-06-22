export async function printPublicGuide(title:string){
  const previous=document.title;document.title=title
  try{window.print()}finally{document.title=previous}
}
