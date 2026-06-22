import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Modal } from '../components/UI'

describe('手机端弹窗',()=>{
  it('挂载到 body 并在打开时锁定背景滚动',()=>{
    const {unmount}=render(<div className="page-enter"><Modal open title="长表单" onClose={()=>undefined}><div style={{height:1800}}>内容</div></Modal></div>)
    const dialog=screen.getByRole('dialog',{name:'长表单'})
    expect(dialog.closest('.modal-backdrop')?.parentElement).toBe(document.body)
    expect(dialog.querySelector('.modal-scroll')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
