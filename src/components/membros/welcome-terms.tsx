'use client'

import { useActionState, useEffect, useRef } from 'react'
import { acceptTerms } from '@/app/[loja]/boas-vindas/actions'
import styles from './welcome-terms.module.css'

const clauses = [
  { title: 'Seu acesso é individual', text: 'A licença está vinculada ao e-mail da sua compra. Você pode acessar seus materiais nos seus dispositivos, mas não ceder seu acesso a outras pessoas.' },
  { title: 'Compartilhamento não é permitido', text: 'Não revenda, publique em grupos ou envie os arquivos e links de acesso a terceiros sem autorização. Respeite as permissões específicas de cada material.' },
  { title: 'Respeite os direitos autorais', text: 'A compra permite o uso conforme a licença do material e não transfere sua autoria ou os direitos de distribuição. Aplicam-se as proteções e exceções previstas em lei.' },
  { title: 'Rastreamento e proteção do acesso', text: 'Os arquivos e acessos possuem identificação. O compartilhamento indevido poderá resultar em restrição de acesso, após análise e conforme a legislação aplicável.' },
]

export function WelcomeTerms({ storeSlug, preview = false }: { storeSlug: string; preview?: boolean }) {
  const [state, action, pending] = useActionState(acceptTerms.bind(null, storeSlug), { error: null })
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])

  return <main className={styles.backdrop}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description">
      <div className={styles.scroll}>
        <header className={styles.header}>
          <span className={styles.brand} aria-hidden="true">A</span>
          <span className={styles.eyebrow}>BOAS-VINDAS À SUA ÁREA DE MEMBROS</span>
          {preview && <p className={styles.preview}>Prévia dos termos · nenhum aceite é registrado</p>}
          <h1 id="welcome-title" ref={heading} tabIndex={-1}>Antes de começar,<br />um combinado.</h1>
          <p id="welcome-description">Seus materiais já estão aqui. Confira os termos de uso para aproveitar seu acesso com tranquilidade.</p>
        </header>
        <section className={styles.body} aria-labelledby="terms-heading">
          <div className={styles.sectionTitle}><h2 id="terms-heading">Termos de uso</h2><span>USO PESSOAL E INTRANSFERÍVEL</span></div>
          <ol className={styles.list}>
            {clauses.map((clause, index) => <li key={clause.title}>
              <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{clause.title}</h3><p>{clause.text}</p></div>
            </li>)}
          </ol>
        </section>
      </div>
      <footer className={styles.footer}>
        <p>Ao continuar, confirmo que li e aceito os termos de uso acima.</p>
        {preview ? <a className={styles.accept} href={`/${storeSlug}?previa=1`}>Aceito os termos <span aria-hidden="true">→</span></a> : <form action={action}>
          <input type="hidden" name="accept" value="yes" />
          <button className={styles.accept} type="submit" disabled={pending}>{pending ? 'Salvando aceite…' : 'Aceito os termos'} <span aria-hidden="true">→</span></button>
          {state.error && <p className={styles.error} role="alert">{state.error}</p>}
        </form>}
        {!preview && <form action={`/sair?loja=${storeSlug}`} method="post"><button className={styles.exit} type="submit">Sair da conta</button></form>}
      </footer>
    </section>
  </main>
}
