create type public.app_role as enum ('admin','instructor','learner');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  department text default '',
  position text default '',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','instructor'))
$$;
create or replace function public.is_approved(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select approved from public.profiles where id = _user_id), false)
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "roles admin insert" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "roles admin delete" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- prevent non-admins from self-approving
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approved is distinct from old.approved and not public.has_role(auth.uid(),'admin') then
    new.approved := old.approved;
  end if;
  return new;
end $$;
create trigger protect_profile_trg before update on public.profiles for each row execute function public.protect_profile();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists(select 1 from public.profiles) into first_user;
  insert into public.profiles(id, full_name, email, department, position, approved)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'department',''),
    coalesce(new.raw_user_meta_data->>'position',''),
    first_user or coalesce((new.raw_user_meta_data->>'pre_approved')::boolean,false));
  insert into public.user_roles(user_id, role) values (new.id, 'learner');
  if first_user then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  category text default '',
  hours numeric default 1,
  cover_url text,
  pass_score int not null default 80,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "courses read" on public.courses for select to authenticated using ((published and public.is_approved(auth.uid())) or public.is_staff(auth.uid()));
create policy "courses insert" on public.courses for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "courses update" on public.courses for update to authenticated using (public.has_role(auth.uid(),'admin') or created_by = auth.uid());
create policy "courses delete" on public.courses for delete to authenticated using (public.has_role(auth.uid(),'admin') or created_by = auth.uid());

create or replace function public.can_edit_course(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or exists(select 1 from public.courses where id=_course and created_by=auth.uid() and public.is_staff(auth.uid()))
$$;

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 0,
  title text not null,
  kind text not null default 'text',
  body text default '',
  video_url text,
  file_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lessons to authenticated;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;
create policy "lessons read" on public.lessons for select to authenticated using (exists(select 1 from public.courses c where c.id = course_id));
create policy "lessons write" on public.lessons for all to authenticated using (public.can_edit_course(course_id)) with check (public.can_edit_course(course_id));

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 0,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index int not null default 0
);
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "questions staff" on public.questions for all to authenticated using (public.can_edit_course(course_id)) with check (public.can_edit_course(course_id));

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, course_id)
);
grant select, insert, delete on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;
create policy "enroll read" on public.enrollments for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "enroll insert" on public.enrollments for insert to authenticated with check (user_id = auth.uid() and public.is_approved(auth.uid()));

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);
grant select, insert on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
alter table public.lesson_progress enable row level security;
create policy "progress read" on public.lesson_progress for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "progress insert" on public.lesson_progress for insert to authenticated with check (user_id = auth.uid());

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null,
  score int not null,
  total int not null,
  percent numeric not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);
grant select on public.test_attempts to authenticated;
grant all on public.test_attempts to service_role;
alter table public.test_attempts enable row level security;
create policy "attempts read" on public.test_attempts for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  cert_no text not null unique,
  score numeric,
  issued_at timestamptz not null default now(),
  unique(user_id, course_id)
);
grant select on public.certificates to authenticated;
grant all on public.certificates to service_role;
alter table public.certificates enable row level security;
create policy "certs read" on public.certificates for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

-- questions for test-taking without answers
create or replace function public.get_test_questions(_course uuid)
returns table(id uuid, question text, options jsonb)
language sql stable security definer set search_path = public as $$
  select q.id, q.question, q.options from public.questions q
  join public.courses c on c.id = q.course_id
  where q.course_id = _course and ((c.published and public.is_approved(auth.uid())) or public.is_staff(auth.uid()))
  order by q.position, q.id
$$;

create or replace function public.submit_test(_course uuid, _kind text, _answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_total int; v_score int := 0; v_pct numeric; v_pass int; v_passed boolean;
  v_lessons int; v_done int; cert_id uuid; r record;
begin
  if uid is null or not public.is_approved(uid) then raise exception 'not allowed'; end if;
  if _kind not in ('pre','post') then raise exception 'bad kind'; end if;
  if not exists(select 1 from public.enrollments where user_id=uid and course_id=_course) then raise exception 'not enrolled'; end if;
  if _kind = 'pre' and exists(select 1 from public.test_attempts where user_id=uid and course_id=_course and kind='pre') then
    raise exception 'pre-test already taken';
  end if;
  select pass_score into v_pass from public.courses where id=_course;
  select count(*) into v_total from public.questions where course_id=_course;
  if v_total = 0 then raise exception 'no questions'; end if;
  for r in select id, correct_index from public.questions where course_id=_course loop
    if (_answers->>(r.id::text))::int = r.correct_index then v_score := v_score + 1; end if;
  end loop;
  v_pct := round(v_score::numeric * 100 / v_total, 1);
  v_passed := v_pct >= v_pass;
  insert into public.test_attempts(user_id, course_id, kind, score, total, percent, passed)
  values (uid, _course, _kind, v_score, v_total, v_pct, v_passed);
  if _kind = 'post' and v_passed then
    select count(*) into v_lessons from public.lessons where course_id=_course;
    select count(*) into v_done from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id where l.course_id=_course and lp.user_id=uid;
    if v_done >= v_lessons then
      insert into public.certificates(user_id, course_id, cert_no, score)
      values (uid, _course, 'CERT-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(random()::text),1,6)), v_pct)
      on conflict (user_id, course_id) do update set score = greatest(public.certificates.score, excluded.score)
      returning id into cert_id;
    end if;
  end if;
  return jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_pct, 'passed', v_passed, 'certificate_id', cert_id);
end $$;
grant execute on function public.get_test_questions(uuid) to authenticated;
grant execute on function public.submit_test(uuid, text, jsonb) to authenticated;