create table if not exists public.ai_state (
  owner_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ai_state enable row level security;

-- No public policies are required when the app accesses this table only
-- from the server using a Supabase secret/service key.
-- Do not expose SUPABASE_SECRET_KEY in browser JavaScript.


create table if not exists public.ai_connector_tokens (
  owner_id text not null,
  connector text not null,
  token jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, connector)
);

alter table public.ai_connector_tokens enable row level security;

-- Keep this table server-only with the Supabase secret/service key.


create table if not exists public.ai_agent_jobs (
  id text primary key,
  owner_id text not null,
  job jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists ai_agent_jobs_owner_idx on public.ai_agent_jobs(owner_id);

create table if not exists public.ai_agent_runs (
  id text primary key,
  owner_id text not null,
  job_id text not null,
  run jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_agent_runs_owner_job_idx on public.ai_agent_runs(owner_id, job_id, created_at desc);

alter table public.ai_agent_jobs enable row level security;
alter table public.ai_agent_runs enable row level security;


create table if not exists public.ai_audit_log (
  id text primary key,
  owner_id text not null,
  event jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_audit_log_owner_created_idx on public.ai_audit_log(owner_id, created_at desc);

create table if not exists public.ai_tool_permissions (
  owner_id text primary key,
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_ledger (
  id text primary key,
  owner_id text not null,
  usage jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_ledger_owner_created_idx on public.ai_usage_ledger(owner_id, created_at desc);

alter table public.ai_audit_log enable row level security;
alter table public.ai_tool_permissions enable row level security;
alter table public.ai_usage_ledger enable row level security;


create table if not exists public.ai_product_state (
  owner_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ai_product_state enable row level security;
