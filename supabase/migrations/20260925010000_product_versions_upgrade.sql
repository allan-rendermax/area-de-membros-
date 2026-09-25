-- Existing single-tier products keep their historical access behavior.
alter table public.products
  add column content_mode text not null default 'sections' check (content_mode in ('sections', 'versions')),
  add column upgrade_image_url text,
  add column upgrade_button_text text check (char_length(upgrade_button_text) <= 80);

update public.products p set content_mode = 'versions'
where p.role = 'front' and exists (
  select 1 from public.modules m
  where m.product_id = p.id and m.required_level = 'complete' and m.is_published
  and exists (
    select 1 from public.items i where i.module_id = m.id and i.is_published
      and i.kind in ('arquivo', 'link') and i.url ~* '^https?://[^/ ]+'
  )
);

notify pgrst, 'reload schema';
