-- VYRO cloud mirror (D21). Only numbers and text: no video, images, audio, chat, AI key or settings.
-- Every row belongs to one user and Row Level Security lets that user, and nobody else, see it.
-- Rows are never hard-deleted by the app: `deleted_at` lets a second computer learn about a delete.
-- Timestamps are milliseconds since the epoch, like in the local SQLite database.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  skill_id text not null,
  started_at bigint not null,
  duration_ms integer not null,
  score integer,
  updated_at bigint not null,
  deleted_at bigint,
  unique (id, user_id)
);
create index sessions_by_user on public.sessions (user_id, updated_at);

-- The composite foreign keys make a child row point only at a parent of the same user.
create table public.reps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  rep_index integer not null,
  quality text not null,
  duration_ms integer not null,
  updated_at bigint not null,
  deleted_at bigint,
  unique (id, user_id),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade
);
create index reps_by_user on public.reps (user_id, updated_at);

create table public.rep_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rep_id uuid not null,
  rule_id text not null,
  updated_at bigint not null,
  deleted_at bigint,
  foreign key (rep_id, user_id) references public.reps (id, user_id) on delete cascade
);
create index rep_errors_by_user on public.rep_errors (user_id, updated_at);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal text not null,
  created_at bigint not null,
  status text not null check (status in ('active', 'completed', 'archived')),
  updated_at bigint not null,
  deleted_at bigint,
  unique (id, user_id)
);
create index learning_paths_by_user on public.learning_paths (user_id, updated_at);

create table public.path_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path_id uuid not null,
  position integer not null,
  title text not null,
  description text not null,
  kind text not null check (kind in ('skill', 'auxiliary')),
  skill_id text,
  criterion_sessions integer,
  criterion_score integer,
  done_at bigint,
  guide_json text,
  updated_at bigint not null,
  deleted_at bigint,
  foreign key (path_id, user_id) references public.learning_paths (id, user_id) on delete cascade,
  -- A skill step is measured, an auxiliary one is not: the same rule as the local database.
  check (
    (kind = 'skill' and skill_id is not null and criterion_sessions is not null and criterion_score is not null)
    or (kind = 'auxiliary' and skill_id is null and criterion_sessions is null and criterion_score is null)
  )
);
create index path_steps_by_user on public.path_steps (user_id, updated_at);

-- A created skill keeps the id the app gave it (a text such as `custom_ab12`), so the key has two parts.
create table public.custom_skills (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  config_json text not null,
  status text not null check (status in ('draft', 'approved')),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);

do $$
declare
  t text;
begin
  foreach t in array array['sessions', 'reps', 'rep_errors', 'learning_paths', 'path_steps', 'custom_skills']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- Without a session (the anon role) nothing is granted at all.
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own_rows', t
    );
  end loop;
end $$;
