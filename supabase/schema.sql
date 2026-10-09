-- Schema für die private Familien-Einkaufsliste (Link-basiert, ohne Login)
-- WICHTIG: Keine service_role Keys im Frontend verwenden.

create extension if not exists pgcrypto;

create table if not exists public.shopping_items (
    id uuid primary key default gen_random_uuid(),
    list_id uuid not null,
    name text not null check (char_length(trim(name)) > 0 and char_length(name) <= 200),
    category text not null default 'Sonstiges' check (char_length(category) <= 80),
    completed boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists shopping_items_list_id_idx
    on public.shopping_items (list_id);

create index if not exists shopping_items_list_id_completed_idx
    on public.shopping_items (list_id, completed);

create index if not exists shopping_items_list_id_created_at_idx
    on public.shopping_items (list_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_shopping_items_updated_at on public.shopping_items;
create trigger trg_shopping_items_updated_at
before update on public.shopping_items
for each row
execute function public.set_updated_at();

-- Liest list_id aus dem Request-Header x-list-id (gesetzt vom Frontend).
create or replace function public.request_list_id()
returns uuid
language sql
stable
as $$
    select case
        when coalesce(current_setting('request.headers', true), '') = '' then null
        when ((current_setting('request.headers', true)::jsonb ->> 'x-list-id') ~*
              '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
            then (current_setting('request.headers', true)::jsonb ->> 'x-list-id')::uuid
        else null
    end;
$$;

alter table public.shopping_items enable row level security;

revoke all on public.shopping_items from anon, authenticated;
grant select, insert, update, delete on public.shopping_items to anon, authenticated;

-- Link-basierter Zugriff: Wer den Listen-Link (UUID) kennt, darf diese Liste lesen/bearbeiten.
-- Ohne passenden x-list-id Header ist kein Zugriff erlaubt.
drop policy if exists "list scoped select" on public.shopping_items;
create policy "list scoped select"
on public.shopping_items
for select
using (list_id = public.request_list_id());

drop policy if exists "list scoped insert" on public.shopping_items;
create policy "list scoped insert"
on public.shopping_items
for insert
with check (list_id = public.request_list_id());

drop policy if exists "list scoped update" on public.shopping_items;
create policy "list scoped update"
on public.shopping_items
for update
using (list_id = public.request_list_id())
with check (list_id = public.request_list_id());

drop policy if exists "list scoped delete" on public.shopping_items;
create policy "list scoped delete"
on public.shopping_items
for delete
using (list_id = public.request_list_id());

-- Realtime aktivieren (falls noch nicht enthalten)
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'shopping_items'
    ) then
        alter publication supabase_realtime add table public.shopping_items;
    end if;
end
$$;
