begin;
create table if not exists public.kairoq_apps (
 id text primary key check (id ~ '^[a-z0-9-]{5,85}$'),
 schema jsonb not null,
 deployed_version integer not null check (deployed_version > 0),
 updated_at timestamptz not null default now()
);
create table if not exists public.kairoq_app_members (
 app_id text not null references public.kairoq_apps(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(app_id,user_id)
);
create table if not exists public.kairoq_app_records (
 id uuid primary key default gen_random_uuid(),
 app_id text not null references public.kairoq_apps(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 collection text not null check (collection ~ '^[a-z][a-z0-9_]{0,39}$'),
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(app_id,user_id) references public.kairoq_app_members(app_id,user_id)
);
create index if not exists kairoq_records_owner on public.kairoq_app_records(app_id,user_id,collection,created_at desc);
alter table public.kairoq_apps enable row level security;
alter table public.kairoq_app_members enable row level security;
alter table public.kairoq_app_records enable row level security;
revoke all on public.kairoq_apps,public.kairoq_app_members,public.kairoq_app_records from anon,authenticated;
grant select on public.kairoq_apps,public.kairoq_app_members to authenticated;
grant select,insert,update,delete on public.kairoq_app_records to authenticated;
grant all on public.kairoq_apps,public.kairoq_app_members,public.kairoq_app_records to service_role;
drop policy if exists kairoq_own_membership on public.kairoq_app_members;
create policy kairoq_own_membership on public.kairoq_app_members for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists kairoq_member_apps on public.kairoq_apps;
create policy kairoq_member_apps on public.kairoq_apps for select to authenticated using (exists(select 1 from public.kairoq_app_members m where m.app_id=id and m.user_id=(select auth.uid())));
drop policy if exists kairoq_owned_records on public.kairoq_app_records;
create policy kairoq_owned_records on public.kairoq_app_records for all to authenticated
 using ((select auth.uid())=user_id and exists(select 1 from public.kairoq_app_members m where m.app_id=kairoq_app_records.app_id and m.user_id=(select auth.uid())))
 with check ((select auth.uid())=user_id and exists(select 1 from public.kairoq_app_members m where m.app_id=kairoq_app_records.app_id and m.user_id=(select auth.uid())));
commit;
