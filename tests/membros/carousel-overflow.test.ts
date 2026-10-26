import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it} from 'vitest'
import {Carousel} from '@/components/membros/carousel'
it('preserves default controls and hides opt-in controls before measuring overflow',()=>{
 expect(renderToStaticMarkup(createElement(Carousel,{title:'Home',children:'Card'}))).toContain('Avançar em Home')
 expect(renderToStaticMarkup(createElement(Carousel,{title:'Owned',controls:'overflow',children:'Card'}))).not.toContain('Avançar em Owned')
})

it('updates opt-in controls when viewport or content sizes change and disconnects on unmount',async()=>{
 const {Window}=await import('happy-dom')
 const {createRoot}=await import('react-dom/client')
 const {act}=await import('react')
 const window=new Window()
 const previous={window:globalThis.window,document:globalThis.document,ResizeObserver:globalThis.ResizeObserver}
 let measure=()=>{}
 let disconnected=false
 Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true,ResizeObserver:class{constructor(callback:()=>void){measure=callback}observe(){}disconnect(){disconnected=true}}})
 const host=window.document.createElement('div');window.document.body.append(host)
 const root=createRoot(host as unknown as HTMLElement)
 try {
  await act(async()=>{root.render(createElement(Carousel,{title:'Owned',controls:'overflow',children:createElement('div',null,'Material')}))})
  const track=host.querySelector('.sem-barra')!
  let width=500
  Object.defineProperty(track,'clientWidth',{get:()=>width})
  Object.defineProperty(track,'scrollWidth',{get:()=>600})
  await act(async()=>{measure()})
  expect(host.querySelectorAll('button')).toHaveLength(2)
  width=700
  await act(async()=>{measure()})
  expect(host.querySelectorAll('button')).toHaveLength(0)
  width=300
  await act(async()=>{measure()})
  expect(host.querySelectorAll('button')).toHaveLength(2)
  await act(async()=>{root.unmount()})
  expect(disconnected).toBe(true)
 } finally { Object.assign(globalThis,previous) }
})
