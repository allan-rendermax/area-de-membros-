drop table public.offer_materials;
drop table public.materials;
alter table public.stores drop column primary_color;

update public.payt_events
   set outcome = case outcome
     when 'processed' then 'sem_mudanca'
     when 'unauthorized' then 'chave_invalida'
     when 'invalid' then 'invalido'
     when 'ignored' then 'ignorado'
     when 'failed' then 'erro'
     else outcome
   end
 where outcome in ('processed', 'unauthorized', 'invalid', 'ignored', 'failed');
