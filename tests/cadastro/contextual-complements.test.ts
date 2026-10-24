import { expect,it } from 'vitest'
import { lerFicha } from '../../scripts/lib/cadastro-plano.mjs'
const base='nome: Atlas\nid: CODE\ntag: front\nloja: arquitetura\nslug: atlas'
it('preserves, clears and orders contextual fields independently of the legacy complement',()=>{
  expect(lerFicha(base)).not.toHaveProperty('complementos')
  expect(lerFicha(`${base}\ncomplementos: nenhum`).complementos).toEqual([])
  expect(lerFicha(`${base}\ncomplementos: guia, orcamento\ncomplemento: protocolo\nvisibilidade_catalogo: contextual`)).toMatchObject({complementos:['guia','orcamento'],complemento:'protocolo',visibilidadeCatalogo:'contextual'})
})
it.each(['guia, guia','atlas','Guia novo','','nenhum, guia'])('rejects ambiguous or invalid list %s',value=>{
  expect(()=>lerFicha(`${base}\ncomplementos: ${value}`)).toThrow()
})
it('rejects unknown visibility',()=>{expect(()=>lerFicha(`${base}\nvisibilidade_catalogo: qualquer`)).toThrow()})
