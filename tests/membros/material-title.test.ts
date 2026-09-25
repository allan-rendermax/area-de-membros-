import { describe, expect, it } from 'vitest'
import { materialTitle } from '@/lib/content/material-title'

describe('nome padrão do material', () => {
  it.each([undefined, '', '  ', ' Clique Aqui ', 'CLIQUE AQUI PARA ACESSAR SEU ATLAS', 'Material principal', 'Material  principal', 'Material\tprincipal'])('usa o produto para título genérico %s', (title) => {
    expect(materialTitle(title, 'Atlas de Fundações')).toBe('Atlas de Fundações')
  })

  it.each(['Plantas editáveis', 'Vídeo de introdução', 'Clique aqui: como funciona o editor'])('preserva o nome personalizado %s', (title) => {
    expect(materialTitle(title, 'Atlas de Fundações')).toBe(title)
  })
})
