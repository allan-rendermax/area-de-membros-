// @vitest-environment happy-dom
import {act,createElement} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect} from 'vitest'
import {AutoCover} from '@/components/membros/auto-cover'
it('keeps an identifiable title when a configured cover cannot load and retries a new URL',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node)
 const props={seed:'x',title:'Guia da Planta Certa',imageUrl:'https://example.test/broken.webp',aspect:'poster' as const}
 act(()=>root.render(createElement(AutoCover,props)))
 act(()=>node.querySelector('img')!.dispatchEvent(new Event('error')))
 expect(node.querySelector('img')).toBeNull()
 expect(node.textContent).toContain(props.title)
 act(()=>root.render(createElement(AutoCover,{...props,imageUrl:'https://example.test/new.webp'})))
 expect(node.querySelector('img')?.getAttribute('src')).toContain('new.webp')
 act(()=>root.unmount());node.remove()
})

