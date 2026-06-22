import type { ChecklistKind } from '../types'

export interface ChecklistTemplateItem { title: string; category: string; quantity?: number }
export interface ChecklistTemplate { id: string; name: string; description: string; kind: ChecklistKind; items: ChecklistTemplateItem[] }

export const checklistTemplates: ChecklistTemplate[] = [
  { id:'packing-basics', name:'基础随身', kind:'行李', description:'证件、通讯和充电必需品', items:[
    {title:'身份证 / 护照',category:'证件'},{title:'银行卡与少量现金',category:'证件'},{title:'手机',category:'电子设备'},
    {title:'充电器',category:'电子设备'},{title:'充电宝',category:'电子设备'},{title:'转换插头',category:'电子设备'},
  ]},
  { id:'packing-toiletries', name:'洗漱用品', kind:'行李', description:'适合酒店与长途旅行的洗护清单', items:[
    {title:'牙刷',category:'洗护'},{title:'牙膏',category:'洗护'},{title:'洗面奶',category:'洗护'},
    {title:'护肤品',category:'洗护'},{title:'防晒霜',category:'洗护'},{title:'梳子',category:'洗护'},
  ]},
  { id:'packing-camera', name:'摄影器材', kind:'行李', description:'相机、电池、存储和支撑设备', items:[
    {title:'相机机身',category:'摄影'},{title:'镜头',category:'摄影'},{title:'备用电池',category:'摄影',quantity:2},
    {title:'存储卡',category:'摄影',quantity:2},{title:'相机充电器',category:'摄影'},{title:'轻便三脚架',category:'摄影'},
  ]},
  { id:'packing-medicine', name:'常备药品', kind:'行李', description:'基础应急药品，请按个人情况调整', items:[
    {title:'创可贴',category:'药品'},{title:'消毒湿巾',category:'药品'},{title:'晕车药',category:'药品'},
    {title:'肠胃药',category:'药品'},{title:'止痛退烧药',category:'药品'},{title:'个人常用药',category:'药品'},
  ]},
  { id:'todo-before-departure', name:'出发前确认', kind:'待办', description:'票证、网络、天气和离线资料', items:[
    {title:'检查证件有效期',category:'证件'},{title:'确认交通与住宿预订',category:'预订'},
    {title:'购买旅行保险',category:'行程确认'},{title:'开通漫游或准备流量卡',category:'交通'},
    {title:'下载离线地图',category:'行程确认'},{title:'查看目的地天气',category:'行程确认'},
  ]},
  { id:'todo-home', name:'离家前检查', kind:'待办', description:'门窗、水电、垃圾与宠物安排', items:[
    {title:'关闭不必要的水电与燃气',category:'其他'},{title:'检查门窗并锁门',category:'其他'},
    {title:'清理垃圾与易腐食物',category:'其他'},{title:'安排宠物或植物照料',category:'其他'},
  ]},
]
