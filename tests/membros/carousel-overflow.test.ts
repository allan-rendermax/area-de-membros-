import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it} from 'vitest'
import {Carousel} from '@/components/membros/carousel'
it('preserves default controls and hides opt-in controls before measuring overflow',()=>{
 expect(renderToStaticMarkup(createElement(Carousel,{title:'Home'},'Card'))).toContain('Avançar em Home')
 expect(renderToStaticMarkup(createElement(Carousel,{title:'Owned',controls:'overflow'},'Card'))).not.toContain('Avançar em Owned')
})

it('updates opt-in controls when viewport or content sizes change and disconnects on unmount',async()=>{
 const {Window}=await import('happy-dom')
 const {createRoot}=await import('react-dom/client')
 const {act}=await import('react')
 const window=new Window()
 const hadActEnvironment=Object.hasOwn(globalThis,'IS_REACT_ACT_ENVIRONMENT')
 const previous={window:globalThis.window,document:globalThis.document,ResizeObserver:globalThis.ResizeObserver,IS_REACT_ACT_ENVIRONMENT:(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT}
 let measure=()=>{}
 let disconnected=false
 Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true,ResizeObserver:class{constructor(callback:()=>void){measure=callback}observe(){}disconnect(){disconnected=true}}})
 const host=window.document.createElement('div');window.document.body.append(host)
 const root=createRoot(host as unknown as HTMLElement)
 try {
  await act(async()=>{root.render(createElement(Carousel,{title:'Owned',controls:'overflow'},createElement('div',null,'Material')))})
  const track=host.querySelector('.sem-barra')!
  let width=500
  let contentWidth=600
  Object.defineProperty(track,'clientWidth',{get:()=>width})
  Object.defineProperty(track,'scrollWidth',{get:()=>contentWidth})
  await act(async()=>{measure()})
  expect(host.querySelectorAll('button')).toHaveLength(2)
  width=700
  await act(async()=>{measure()})
  expect(host.querySelectorAll('button')).toHaveLength(0)
  contentWidth=900
  await act(async()=>{measure()})
  expect(host.querySelectorAll('button')).toHaveLength(2)
  await act(async()=>{root.unmount()})
  expect(disconnected).toBe(true)
 } finally {
  Object.assign(globalThis,previous)
  if (!hadActEnvironment) delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
 }
})
