create extension if not exists pg_trgm;

create index if not exists products_code_idx
  on public.products(code);

create index if not exists products_active_created_idx
  on public.products(is_deleted, is_active, created_at desc);

create index if not exists products_name_trgm_idx
  on public.products
  using gin (name gin_trgm_ops);

create index if not exists products_code_trgm_idx
  on public.products
  using gin (code gin_trgm_ops);
