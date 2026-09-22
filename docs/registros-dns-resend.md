# Registros DNS do Resend — grupoelevamax.com (22/09/2026)

Domínio no Resend: id `0bb95f9e-6317-4d0a-8f7d-99ff36363878`, região `sa-east-1`.
Adicionar na Cloudflare (DNS → Registros → Adicionar registro). Todos com **Proxy: Somente DNS** e **TTL: Auto**.

## 1. TXT (DKIM — assina os emails)
- Tipo: `TXT`
- Nome: `resend._domainkey`
- Conteúdo:
```
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDNKUGEF2qlJ8Oi4/b9mpwDo4A7E5JdU0Cv+c2+JCjGT34745QqG72sManOg/1v+MqeG5GJqMLx5LJlO+qE7wd4M6MG/u5wWaXpnRgd+zfu9CgMgEg2wFuDqeiOz3kFlDYgKHZmmvxGTb54nwfzeYGDQ4PXzWdtRkhzhCFYyFK+uwIDAQAB
```

## 2. MX (retorno de entrega)
- Tipo: `MX`
- Nome: `send`
- Servidor de email: `feedback-smtp.sa-east-1.amazonses.com`
- Prioridade: `10`

## 3. TXT (SPF — autoriza o envio)
- Tipo: `TXT`
- Nome: `send`
- Conteúdo:
```
v=spf1 include:amazonses.com ~all
```

## 4. CNAME
- Tipo: `CNAME`
- Nome: `rsend`
- Destino: `send.forge.rmta.net`
- Proxy: **Somente DNS** (se ficar laranja/proxy, o Resend não verifica)

## Depois
Resend → Domains → grupoelevamax.com → **Verify DNS Records**.
Os registros existentes (`A` do site e `www`) não devem ser alterados.
