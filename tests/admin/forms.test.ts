import { describe, expect, it } from 'vitest'
import { FormError, parseItemForm, parseModuleForm, parseOfferForm, parseProductForm, parseStoreForm } from '@/lib/admin/forms'

const UUID = '0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'

function fd(entries: Record<string, string | string[]>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    for (const v of Array.isArray(value) ? value : [value]) form.append(key, v)
  }
  return form
}

describe('parseStoreForm', () => {
  it('gera o endereço a partir do nome e normaliza o WhatsApp', () => {
    expect(parseStoreForm(fd({ name: 'Nutrição Animal', support_whatsapp: '+55 11 99999-8888' }))).toEqual({
      id: null, slug: 'nutricao-animal', name: 'Nutrição Animal', logoUrl: null,
      supportWhatsapp: '5511999998888', supportUrl: null, loginImageUrl: null,
    })
  })

  it('recusa nome vazio, endereço reservado, WhatsApp e links inválidos', () => {
    expect(() => parseStoreForm(fd({ name: '' }))).toThrow(FormError)
    expect(() => parseStoreForm(fd({ name: 'X', slug: 'admin' }))).toThrow('Endereço inválido')
    expect(() => parseStoreForm(fd({ name: 'X', support_whatsapp: '123' }))).toThrow('WhatsApp inválido')
    expect(() => parseStoreForm(fd({ name: 'X', support_url: 'javascript:alert(1)' }))).toThrow('Link inválido')
  })
})

describe('parseProductForm', () => {
  it('lê campos, marcações e ordem', () => {
    expect(
      parseProductForm(
        fd({ title: 'Atlas Visual', description: ' texto ', checkout_url: 'https://payt.com/x', sort_order: '3', is_featured: 'on', is_published: 'on' }),
        's1',
      ),
    ).toEqual({
      id: null, storeId: 's1', slug: 'atlas-visual', title: 'Atlas Visual', description: 'texto',
      coverUrl: null, bannerUrl: null, checkoutUrl: 'https://payt.com/x', isFeatured: true, sortOrder: 3, isPublished: true,
    })
  })

  it('recusa título vazio e endereço inválido', () => {
    expect(() => parseProductForm(fd({ title: '' }), 's1')).toThrow('Informe o título')
    expect(() => parseProductForm(fd({ title: 'A', slug: 'Com Espaço' }), 's1')).toThrow('Endereço do produto inválido')
  })
})

describe('parseModuleForm', () => {
  it('lê o módulo', () => {
    expect(parseModuleForm(fd({ title: 'Módulo 1', product_id: UUID, is_published: 'on' }))).toEqual({
      id: null, productId: UUID, title: 'Módulo 1', isPublished: true,
    })
  })

  it('recusa nome vazio', () => {
    expect(() => parseModuleForm(fd({ title: ' ', product_id: UUID }))).toThrow('Informe o nome do módulo')
  })
})

describe('parseItemForm', () => {
  it('aceita vídeo reconhecido', () => {
    expect(parseItemForm(fd({ title: 'Aula 1', kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', module_id: UUID, is_published: 'on' }))).toEqual({
      id: null, moduleId: UUID, title: 'Aula 1', kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', coverUrl: null, isPublished: true,
    })
  })

  it('recusa vídeo não reconhecido, tipo inválido, link ausente e módulo inválido', () => {
    expect(() => parseItemForm(fd({ title: 'A', kind: 'video', url: 'https://drive.google.com/x', module_id: UUID }))).toThrow('Vídeo não reconhecido')
    expect(() => parseItemForm(fd({ title: 'A', kind: 'pdf', url: 'https://x.com', module_id: UUID }))).toThrow('Tipo de item inválido')
    expect(() => parseItemForm(fd({ title: 'A', kind: 'arquivo', module_id: UUID }))).toThrow('Informe o link')
    expect(() => parseItemForm(fd({ title: 'A', kind: 'arquivo', url: 'https://x.com', module_id: 'x' }))).toThrow('Registro inválido')
  })
})

describe('parseOfferForm', () => {
  it('lê código e produtos', () => {
    expect(parseOfferForm(fd({ name: 'Plano Completo', payt_product_code: 'ATLAS-COMPLETO', product_ids: [UUID] }), 's1')).toEqual({
      id: null, storeId: 's1', name: 'Plano Completo', paytProductCode: 'ATLAS-COMPLETO', productIds: [UUID],
    })
  })

  it('recusa código com espaço e produto inválido', () => {
    expect(() => parseOfferForm(fd({ name: 'X', payt_product_code: 'COM ESPACO' }), 's1')).toThrow('sem espaços')
    expect(() => parseOfferForm(fd({ name: 'X', payt_product_code: 'OK', product_ids: ['nao-uuid'] }), 's1')).toThrow('Produto inválido')
  })
})
