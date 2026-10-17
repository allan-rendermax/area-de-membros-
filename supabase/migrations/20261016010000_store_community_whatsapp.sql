alter table public.stores add column if not exists community_whatsapp_url text;
update public.stores
set community_whatsapp_url = 'https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t'
where slug = 'arquitetura' and community_whatsapp_url is null;
