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
  it('valida personalização do modal e permite remover a imagem', () => {
    const fields = { title: 'Atlas', purchase_title: '  Tenha seu Atlas  ', purchase_description: 'Linha 1\n\nLinha 2', purchase_button_text: 'Quero comprar', purchase_image_url: 'https://example.com/mockup.png' }
    expect(parseProductForm(fd(fields), 's1')).toMatchObject({ purchaseTitle: 'Tenha seu Atlas', purchaseDescription: 'Linha 1\n\nLinha 2', purchaseButtonText: 'Quero comprar', purchaseImageUrl: 'https://example.com/mockup.png' })
    expect(parseProductForm(fd({ ...fields, remove_purchase_image: 'on' }), 's1').purchaseImageUrl).toBeNull()
    for (const [key, value] of Object.entries({ purchase_title: 'x'.repeat(121), purchase_description: 'x'.repeat(5001), purchase_button_text: 'x'.repeat(81), purchase_image_url: 'javascript:alert(1)' })) {
      expect(() => parseProductForm(fd({ title: 'Atlas', [key]: value }), 's1')).toThrow(FormError)
    }
  })
  it('configura versões, packs e apresentação do upgrade com limites', () => {
    expect(parseProductForm(fd({ title: 'Atlas', upgrade_button_text: '  Quero meu completo  ', upgrade_image_url: 'https://example.com/mockup.png' }), 's1')).toMatchObject({ contentMode: 'versions', upgradeButtonText: 'Quero meu completo', upgradeImageUrl: 'https://example.com/mockup.png' })
    expect(parseProductForm(fd({ title: 'Pack', content_mode: 'sections' }), 's1').contentMode).toBe('sections')
    expect(parseProductForm(fd({ title: 'Extra', role: 'upsell', checkout_url: 'https://example.com' }), 's1').contentMode).toBe('sections')
    expect(() => parseProductForm(fd({ title: 'Atlas', content_mode: 'other' }), 's1')).toThrow('Organização')
    expect(() => parseProductForm(fd({ title: 'Atlas', upgrade_button_text: 'x'.repeat(81) }), 's1')).toThrow('80 caracteres')
    expect(() => parseProductForm(fd({ title: 'Atlas', upgrade_image_url: 'javascript:bad' }), 's1')).toThrow('Link inválido')
  })
  it('lê campos, marcações e ordem', () => {
    expect(
      parseProductForm(
        fd({ title: 'Atlas Visual', track: ' Patologias ', description: ' texto ', checkout_url: 'https://payt.com/x', sort_order: '3', is_featured: 'on', is_published: 'on' }),
        's1',
      ),
    ).toEqual({
      id: null, storeId: 's1', slug: 'atlas-visual', title: 'Atlas Visual', track: 'Patologias', description: 'texto',
      coverUrl: null, bannerUrl: null, checkoutUrl: 'https://payt.com/x', upgradeCheckoutUrl: null, contentMode: 'versions', upgradeImageUrl: null, upgradeButtonText: null, purchaseTitle: null, purchaseDescription: null, purchaseImageUrl: null, purchaseButtonText: null, studentCheckoutUrl: null, role: 'front', isFeatured: true, sortOrder: 3, isPublished: true,
    })
    expect(parseProductForm(fd({ title: 'Atlas Visual' }), 's1').track).toBe('')
    expect(parseProductForm(fd({ title: 'Atlas Visual', track: '   ' }), 's1').track).toBe('')
  })

  it('recusa título vazio e endereço inválido', () => {
    expect(() => parseProductForm(fd({ title: '' }), 's1')).toThrow('Informe o título')
    expect(() => parseProductForm(fd({ title: 'A', slug: 'Com Espaço' }), 's1')).toThrow('Endereço do produto inválido')
  })

  it('aceita papéis complementares com checkout e rejeita papel inválido ou checkout ausente', () => {
    expect(parseProductForm(fd({ title: 'Bônus', role: 'orderbump', checkout_url: 'https://payt.com/bump' }), 's1').role).toBe('orderbump')
    expect(parseProductForm(fd({ title: 'Extra', role: 'upsell', checkout_url: 'https://payt.com/extra' }), 's1').role).toBe('upsell')
    expect(() => parseProductForm(fd({ title: 'Extra', role: 'fake' }), 's1')).toThrow('Papel')
    expect(() => parseProductForm(fd({ title: 'Extra', role: 'upsell' }), 's1')).toThrow('checkout')
  })

  it('aceita checkout de upgrade HTTP(S) e recusa URL inválida', () => {
    expect(parseProductForm(fd({ title: 'Atlas', upgrade_checkout_url: 'https://payt.com/upgrade' }), 's1').upgradeCheckoutUrl).toBe('https://payt.com/upgrade')
    expect(() => parseProductForm(fd({ title: 'Atlas', upgrade_checkout_url: 'javascript:bad' }), 's1')).toThrow('Link inválido')
  })

  it('preserva checkout de aluno completo, trata vazio como null e recusa protocolo inseguro', () => {
    const promotional = 'https://checkout.example.test/item?coupon=ALUNO10&utm_source=members#payment'
    expect(parseProductForm(fd({ title: 'Atlas', student_checkout_url: promotional }), 's1').studentCheckoutUrl).toBe(promotional)
    expect(parseProductForm(fd({ title: 'Atlas', student_checkout_url: '   ' }), 's1').studentCheckoutUrl).toBeNull()
    expect(() => parseProductForm(fd({ title: 'Atlas', student_checkout_url: 'javascript:alert(1)' }), 's1')).toThrow('Link inválido')
  })
})

describe('parseModuleForm', () => {
  it('lê o módulo', () => {
    expect(parseModuleForm(fd({ title: 'Módulo 1', product_id: UUID, is_published: 'on' }))).toEqual({
      id: null, productId: UUID, title: 'Módulo 1', isPublished: true, requiredLevel: 'basic',
    })
  })

  it('recusa nome vazio', () => {
    expect(() => parseModuleForm(fd({ title: ' ', product_id: UUID }))).toThrow('Informe o nome do módulo')
  })
  it('aceita complete e recusa nível inválido', () => {
    expect(parseModuleForm(fd({ title: 'Extras', product_id: UUID, required_level: 'complete' })).requiredLevel).toBe('complete')
    expect(() => parseModuleForm(fd({ title: 'Extras', product_id: UUID, required_level: 'vip' }))).toThrow('Nível')
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
      id: null, storeId: 's1', name: 'Plano Completo', paytProductCode: 'ATLAS-COMPLETO', productIds: [UUID], productLevels: { [UUID]: 'complete' },
    })
  })

  it('recusa código com espaço e produto inválido', () => {
    expect(() => parseOfferForm(fd({ name: 'X', payt_product_code: 'COM ESPACO' }), 's1')).toThrow('sem espaços')
    expect(() => parseOfferForm(fd({ name: 'X', payt_product_code: 'OK', product_ids: ['nao-uuid'] }), 's1')).toThrow('Produto inválido')
  })

  it('recusa oferta sem produto', () => {
    expect(() => parseOfferForm(fd({ name: 'X', payt_product_code: 'OK' }), 's1')).toThrow('produto')
  })
  it('lê nível por produto e recusa valor inválido', () => {
    expect(parseOfferForm(fd({ name: 'Básico', payt_product_code: 'BASIC', product_ids: [UUID], [`grant_level_${UUID}`]: 'basic' }), 's1').productLevels).toEqual({ [UUID]: 'basic' })
    expect(() => parseOfferForm(fd({ name: 'X', payt_product_code: 'OK', product_ids: [UUID], [`grant_level_${UUID}`]: 'vip' }), 's1')).toThrow('Nível')
  })
})
