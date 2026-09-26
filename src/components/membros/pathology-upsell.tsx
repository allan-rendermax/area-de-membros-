import styles from './pathology-upsell.module.css'

// Oferta específica aprovada para o Atlas, independente do nível Básico/Completo.
const ATLAS_SLUG = 'atlas-visual-das-patologias-na-construcao-civil-completo'
const PROTOCOLO_CHECKOUT = 'https://checkout.payt.com.br/f2b5337a076c0be3ccd09fdcfc651601'

export function PathologyUpsell({ storeSlug, productSlug }: { storeSlug: string; productSlug: string }) {
  if (storeSlug !== 'arquitetura' || productSlug !== ATLAS_SLUG) return null

  return (
    <section className={styles.offer} aria-labelledby="protocolo-upsell-title">
      <span className={styles.label}>OFERTA PARA ALUNOS DO ATLAS</span>
      <h2 id="protocolo-upsell-title">Você deixou isso passar no checkout.</h2>
      <p>
        Com o <strong>Protocolo Anti-Retrabalho</strong>, você consulta seguindo a sequência correta{' '}
        <strong>Causa → Interrupção → Acabamento</strong> para reduzir erros que fazem o reparo voltar.
      </p>
      <a href={PROTOCOLO_CHECKOUT} target="_blank" rel="noopener noreferrer">
        QUERO O PROTOCOLO ANTI-RETRABALHO <span aria-hidden="true">→</span>
      </a>
    </section>
  )
}
