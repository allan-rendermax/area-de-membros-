# E-mail liberado — 22/09/2026

## O que estava quebrado
O domínio do Resend havia sido apagado durante a migração do DNS para a Cloudflare (17/09), e os registros de e-mail não existiam mais. Sem isso, nenhum cliente recebia e-mail e o código de acesso do admin não chegava.

## O que foi feito
- Domínio `grupoelevamax.com` recriado no Resend: id `0bb95f9e-6317-4d0a-8f7d-99ff36363878`, região `sa-east-1`.
- Quatro registros adicionados na Cloudflare (todos **Somente DNS**, sem proxy):
  - TXT `resend._domainkey` (DKIM)
  - MX `send` → `feedback-smtp.sa-east-1.amazonses.com`, prioridade 10
  - TXT `send` → `v=spf1 include:amazonses.com ~all`
  - CNAME `rsend` → `send.forge.rmta.net`
- Um percalço: o `rsend` foi criado com proxy ligada (nuvem laranja), o que escondia o destino e impedia a verificação. Desligar a proxy resolveu.
- Registros conferidos direto no servidor autoritativo da Cloudflare (`lamar.ns.cloudflare.com`), evitando respostas antigas de cache.
- **Domínio verificado no Resend** (os 4 registros).

## Verificações de entrega
- E-mail de teste para `arq.allanp@gmail.com`: status `delivered`, caixa de entrada (não spam).
- Segundo teste pelo mesmo mecanismo do sistema (SDK do Resend), com acentos: chegou correto.
- Observação: um primeiro teste enviado por linha de comando chegou com acentos quebrados. Era limitação do comando de teste, não do sistema.

## Efeito
- Envio para qualquer cliente liberado (antes só para o dono da conta Resend).
- Código de acesso do admin passa a chegar, destravando o cadastro dos produtos reais.
