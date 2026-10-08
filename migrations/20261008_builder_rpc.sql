begin;
create schema if not exists kairoq_private;
revoke all on schema kairoq_private from public,anon,authenticated;
create table if not exists kairoq_private.builder_access(id text primary key,token_hash text not null);
alter table kairoq_private.builder_access enable row level security;
revoke all on kairoq_private.builder_access from public,anon,authenticated;
-- SHA-256 of a generated credential; plaintext lives only in Railway.
insert into kairoq_private.builder_access values ('kairoq','BUILDER_TOKEN_SHA256') on conflict(id) do update set token_hash=excluded.token_hash;
create or replace function public.kairoq_builder_health(admin_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from kairoq_private.builder_access where id='kairoq' and token_hash=encode(extensions.digest(admin_token,'sha256'),'hex')) then raise insufficient_privilege using message='Builder credential rejected'; end if;
 return jsonb_build_object('ready',true);
end;$$;
create or replace function public.kairoq_builder_provision(admin_token text,target_app text,app_schema jsonb,app_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from kairoq_private.builder_access where id='kairoq' and token_hash=encode(extensions.digest(admin_token,'sha256'),'hex')) then raise insufficient_privilege using message='Builder credential rejected'; end if;
 if target_app !~ '^[a-z0-9-]{5,85}$' or app_version<1 or jsonb_typeof(app_schema->'collections') is distinct from 'array' or length(app_schema::text)>150000 then raise invalid_parameter_value using message='Invalid app manifest'; end if;
 insert into public.kairoq_apps(id,schema,deployed_version) values(target_app,app_schema,app_version) on conflict(id) do update set schema=excluded.schema,deployed_version=excluded.deployed_version,updated_at=now();
end;$$;
create or replace function public.kairoq_builder_enroll(admin_token text,target_app text,target_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from kairoq_private.builder_access where id='kairoq' and token_hash=encode(extensions.digest(admin_token,'sha256'),'hex')) then raise insufficient_privilege using message='Builder credential rejected'; end if;
 insert into public.kairoq_app_members(app_id,user_id) values(target_app,target_user) on conflict do nothing;
end;$$;
revoke all on function public.kairoq_builder_health(text),public.kairoq_builder_provision(text,text,jsonb,integer),public.kairoq_builder_enroll(text,text,uuid) from public,anon,authenticated;
grant execute on function public.kairoq_builder_health(text),public.kairoq_builder_provision(text,text,jsonb,integer),public.kairoq_builder_enroll(text,text,uuid) to anon,authenticated;
commit;
