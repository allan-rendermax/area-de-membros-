import { ARCHITECTURE_HERO } from '@/lib/membros/theme'
import { ContentImage } from './content-image'

export function ArchitectureHero() {
  return (
    <section className="arq-hero" aria-label="Seu acervo de arquitetura">
      <ContentImage src={ARCHITECTURE_HERO} sizes="100vw" eager className="arq-hero-image h-full w-full object-cover" />
      <div className="arq-hero-copy">
        <p className="arq-kicker">Seu acervo criativo</p>
        <h1 className="arq-headline">Menos tempo no zero.<span>Mais projeto pronto.</span></h1>
        <p className="arq-hero-description">Materiais visuais e ferramentas para colocar suas ideias em prática.</p>
        <a className="arq-cta" href="#materiais">Explorar meus materiais <span aria-hidden>→</span></a>
        <p className="arq-hero-footer">Ideias + ferramentas + referências = mais arquitetura no seu dia</p>
      </div>
    </section>
  )
}
