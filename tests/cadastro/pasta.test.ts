import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lerPastaProduto } from '../../scripts/lib/cadastro-pasta.mjs'

const temporarios: string[] = []
async function pasta() {
  const directory = await mkdtemp(join(tmpdir(), 'cadastro-pasta-'))
  temporarios.push(directory)
  await writeFile(join(directory, 'produto.txt'), 'nome: Kit\nid: ABC\ntag: front\n')
  return directory
}
afterEach(async () => { await Promise.all(temporarios.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

describe('leitura local da pasta', () => {
  it('retorna plano com caminhos absolutos, tamanhos e links', async () => {
    const directory = await pasta()
    await mkdir(join(directory, 'entregaveis', '01 Guias'), { recursive: true })
    await writeFile(join(directory, 'entregaveis', '01 Guias', 'Manual.pdf'), 'abc')
    await writeFile(join(directory, 'links.txt'), 'Vídeo | https://youtu.be/abc')
    const plano = await lerPastaProduto(directory, { defaultStoreSlug: 'arquitetura' })
    expect(plano.folder).toBe(directory)
    expect(plano.ficha).toMatchObject({ loja: 'arquitetura', slug: 'kit' })
    expect(plano.arquivos).toEqual([expect.objectContaining({ relativePath: 'entregaveis/01 Guias/Manual.pdf', absolutePath: join(directory, 'entregaveis', '01 Guias', 'Manual.pdf'), size: 3 })])
    expect(plano.modulos.map((m: {title: string}) => m.title)).toEqual(['Guias', 'Conteúdo online'])
  })

  it('rejeita arquivo ilegível ou pasta sem ficha', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cadastro-pasta-'))
    temporarios.push(directory)
    await expect(lerPastaProduto(directory)).rejects.toThrow(/produto\.txt/i)
  })

  it('rejeita symlink dentro de entregáveis', async () => {
    const directory = await pasta()
    await mkdir(join(directory, 'entregaveis'))
    await mkdir(join(directory, 'fora'))
    await symlink(join(directory, 'fora'), join(directory, 'entregaveis', 'atalho'), 'junction')
    await expect(lerPastaProduto(directory, { defaultStoreSlug: 'arquitetura' })).rejects.toThrow(/link simbólico/i)
  })

  it('rejeita subpasta profunda', async () => {
    const directory = await pasta()
    await mkdir(join(directory, 'entregaveis', 'Módulo', 'Extra'), { recursive: true })
    await writeFile(join(directory, 'entregaveis', 'Módulo', 'Extra', 'Guia.pdf'), 'a')
    await expect(lerPastaProduto(directory, { defaultStoreSlug: 'arquitetura' })).rejects.toThrow(/subpasta|profund/i)
  })

  it('rejeita módulo vazio, que não poderia ser cadastrado', async () => {
    const directory = await pasta()
    await mkdir(join(directory, 'entregaveis', 'Módulo'), { recursive: true })
    await expect(lerPastaProduto(directory, { defaultStoreSlug: 'arquitetura' })).rejects.toThrow(/vazi/i)
  })
})
