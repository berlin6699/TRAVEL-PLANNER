import { describe, expect, it } from 'vitest'
import { checklistTemplates } from '../data/checklistTemplates'

describe('可复用清单模板',()=>{
  it('模板 id 唯一且项目完整',()=>{
    expect(new Set(checklistTemplates.map(x=>x.id)).size).toBe(checklistTemplates.length)
    expect(checklistTemplates.every(x=>x.items.length>0&&x.items.every(item=>item.title&&item.category))).toBe(true)
  })
  it('包含洗漱、摄影和跨旅程待办模板',()=>{
    expect(checklistTemplates.some(x=>x.items.some(item=>item.category==='洗护'))).toBe(true)
    expect(checklistTemplates.some(x=>x.items.some(item=>item.category==='摄影'))).toBe(true)
    expect(checklistTemplates.some(x=>x.kind==='待办')).toBe(true)
  })
})
