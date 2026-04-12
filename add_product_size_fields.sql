alter table if exists public.products
  add column if not exists size_label text,
  add column if not exists size_code text;

create index if not exists products_size_code_idx on public.products(size_code);
