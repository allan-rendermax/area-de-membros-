# Decisões de execução e consequências

Registro completo das decisões do diário, em ordem. Não houve achado menor adiado na revisão independente.

1. Executar e preparar localmente; deixar ativação para a etapa de publicação prevista no plano. Consequência: a organização ainda não está ativa para clientes reais.
2. Usar checkout isolado baseado no SHA publicado conferido, preservando o workspace original com alterações preexistentes. Consequência: integrar/reconciliar a versão antes da publicação; divergência futura bloqueia o deploy.
3. Rodar testes com dois workers e limite de 20 segundos por teste SQL após contenção local de CPU. Consequência: execução mais lenta; limite da aplicação não foi alterado.
4. Consolidar verificações SQL e links antigos nos arquivos de testes existentes dedicados a esses comportamentos. Consequência: organização dos testes difere dos nomes sugeridos pelo plano, sem exclusão de cenários.
5. Fazer a RPC retornar ID e revisão confirmada, evitando reler uma revisão que outra edição possa alterar. Consequência: os consumidores precisam usar esse contrato. A hipótese inicial de que preservar URLs bastaria para preservar imagens foi refutada na revisão: o importador contextual agora cria caminhos novos sem sobrescrita. Tentativas recusadas podem deixar arquivos sem referência que exigem conferência antes de limpeza.
6. Manter o conteúdo e a lista lateral existentes entre o cabeçalho aprovado e as fileiras. Consequência: preserva os fluxos atuais, mas um ajuste posterior de espaçamento continua possível.
7. Tratar códigos/checkouts de Paisagismo, fichas importáveis e conferência remota de entrega como pré-requisitos de ativação. Consequência: os seis não podem ser declarados liberados ainda; nenhum código foi inventado. O PDF final de Mestres foi localizado e validado.
8. Usar aplicativo real com serviços sintéticos locais para o navegador e PostgreSQL real separado para concorrência. Consequência: testes locais não comprovam entrega comercial real na Payt.
9. Conservar branch e worktree da implementação para a etapa de publicação, seguindo o escopo local aprovado. Consequência: não há merge, push ou deploy nesta entrega. Artes originais e PDFs otimizados permanecem no worktree; finais WebP e relatórios estão versionados.
