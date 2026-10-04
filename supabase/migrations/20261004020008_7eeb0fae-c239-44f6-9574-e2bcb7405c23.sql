create table public.member_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  target_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.member_audit_log to authenticated;
grant all on public.member_audit_log to service_role;
alter table public.member_audit_log enable row level security;
create policy "admins read audit" on public.member_audit_log for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create index on public.member_audit_log (created_at desc);

create or replace function public.log_profile_change() returns trigger language plpgsql security definer set search_path = public as $$
declare ch jsonb := '{}'::jsonb; k text;
begin
  if tg_op = 'INSERT' then
    insert into member_audit_log(actor_id, target_id, action, details)
    values (auth.uid(), new.id, 'created', jsonb_build_object('full_name', new.full_name, 'email', new.email));
    return new;
  end if;
  if auth.uid() is null then return new; end if;
  if new.approved is distinct from old.approved then
    insert into member_audit_log(actor_id, target_id, action, details)
    values (auth.uid(), new.id, case when new.approved then 'approved' else 'unapproved' end, '{}'::jsonb);
  end if;
  foreach k in array array['full_name','division','department','position','email'] loop
    if (to_jsonb(new)->>k) is distinct from (to_jsonb(old)->>k) then
      ch := ch || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old)->>k, 'to', to_jsonb(new)->>k));
    end if;
  end loop;
  if ch <> '{}'::jsonb then
    insert into member_audit_log(actor_id, target_id, action, details) values (auth.uid(), new.id, 'updated', ch);
  end if;
  return new;
end $$;
revoke execute on function public.log_profile_change() from anon, authenticated, public;
create trigger log_profile_change_trg after insert or update on public.profiles for each row execute function public.log_profile_change();

create or replace function public.log_role_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    insert into member_audit_log(actor_id, target_id, action, details) values (auth.uid(), new.user_id, 'role_added', jsonb_build_object('role', new.role));
    return new;
  else
    insert into member_audit_log(actor_id, target_id, action, details) values (auth.uid(), old.user_id, 'role_removed', jsonb_build_object('role', old.role));
    return old;
  end if;
end $$;
revoke execute on function public.log_role_change() from anon, authenticated, public;
create trigger log_role_change_trg after insert or delete on public.user_roles for each row execute function public.log_role_change();

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 0,
  kind text not null default 'rating' check (kind in ('rating','text')),
  prompt text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.survey_questions to authenticated;
grant all on public.survey_questions to service_role;
alter table public.survey_questions enable row level security;
create policy "read survey q" on public.survey_questions for select to authenticated using (public.can_edit_course(course_id) or public.can_access_course(course_id, auth.uid()));
create policy "edit survey q" on public.survey_questions for all to authenticated using (public.can_edit_course(course_id)) with check (public.can_edit_course(course_id));

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);
grant select, insert on public.survey_responses to authenticated;
grant all on public.survey_responses to service_role;
alter table public.survey_responses enable row level security;
create policy "own or staff read" on public.survey_responses for select to authenticated using (user_id = auth.uid() or public.can_edit_course(course_id));
create policy "enrolled insert" on public.survey_responses for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.enrollments e where e.course_id = survey_responses.course_id and e.user_id = auth.uid()));

create table public.survey_summaries (
  course_id uuid primary key references public.courses(id) on delete cascade,
  summary text not null,
  response_count int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.survey_summaries to authenticated;
grant all on public.survey_summaries to service_role;
alter table public.survey_summaries enable row level security;
create policy "staff summaries" on public.survey_summaries for all to authenticated using (public.can_edit_course(course_id)) with check (public.can_edit_course(course_id));