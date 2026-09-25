alter table public.products
  add column purchase_title text check (char_length(purchase_title) <= 120),
  add column purchase_description text check (char_length(purchase_description) <= 5000),
  add column purchase_image_url text,
  add column purchase_button_text text check (char_length(purchase_button_text) <= 80);

notify pgrst, 'reload schema';
