alter table public.products
  add column complementary_product_id uuid;

alter table public.products
  add constraint products_store_id_id_unique unique (store_id, id),
  add constraint products_complement_not_self check (complementary_product_id is distinct from id),
  add constraint products_complement_same_store foreign key (store_id, complementary_product_id)
    references public.products (store_id, id) on delete set null (complementary_product_id);

update public.products as source
set complementary_product_id = target.id
from public.stores as store, public.products as target
where store.id = source.store_id
  and store.slug = 'arquitetura'
  and source.slug = 'atlas-visual-das-patologias-na-construcao-civil-completo'
  and target.store_id = store.id
  and target.slug = 'protocolo-anti-retrabalho'
  and source.complementary_product_id is null;
