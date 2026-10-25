-- Organization structure: divisions (ฝ่าย) -> units (แผนก/หน่วย), with managers (หัวหน้า).

CREATE TABLE IF NOT EXISTS public.org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  kind text NOT NULL CHECK (kind IN ('division','unit')),
  parent_id uuid REFERENCES public.org_units(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_units_kind_parent CHECK ((kind = 'division' AND parent_id IS NULL) OR (kind = 'unit' AND parent_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS org_units_division_name ON public.org_units (lower(name)) WHERE kind = 'division';
CREATE UNIQUE INDEX IF NOT EXISTS org_units_unit_name ON public.org_units (parent_id, lower(name)) WHERE kind = 'unit';

CREATE TABLE IF NOT EXISTS public.org_unit_managers (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_unit_id uuid NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_unit_id)
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_unit_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_org_unit_idx ON public.profiles (org_unit_id);

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_unit_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org units read" ON public.org_units;
CREATE POLICY "org units read" ON public.org_units FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "org units admin write" ON public.org_units;
CREATE POLICY "org units admin write" ON public.org_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "org managers read" ON public.org_unit_managers;
CREATE POLICY "org managers read" ON public.org_unit_managers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "org managers admin write" ON public.org_unit_managers;
CREATE POLICY "org managers admin write" ON public.org_unit_managers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Resolve free-text division/department to an org unit (unit first, division when no department).
CREATE OR REPLACE FUNCTION public.resolve_org_unit(_division text, _department text)
RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  select case
    when coalesce(trim(_department), '') <> '' then
      (select u.id from org_units u join org_units d on d.id = u.parent_id
        where u.kind = 'unit' and lower(u.name) = lower(trim(_department)) and lower(d.name) = lower(trim(coalesce(_division, ''))) limit 1)
    when coalesce(trim(_division), '') <> '' then
      (select id from org_units where kind = 'division' and lower(name) = lower(trim(_division)) limit 1)
    else null end
$$;

-- Units a user manages: directly assigned units plus every unit under an assigned division. Admin manages all.
CREATE OR REPLACE FUNCTION public.managed_units(_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select u.id from org_units u where public.has_role(_user, 'admin')
  union
  select u.id from org_units u
   where exists (select 1 from org_unit_managers m where m.user_id = _user and (m.org_unit_id = u.id or m.org_unit_id = u.parent_id))
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select public.has_role(_user, 'admin') or exists (select 1 from org_unit_managers where user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user(_manager uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select _manager is not null and (
    public.has_role(_manager, 'admin')
    or exists (select 1 from profiles p where p.id = _target and p.org_unit_id in (select public.managed_units(_manager)))
  )
$$;

-- Keep org_unit_id and the legacy text columns consistent.
CREATE OR REPLACE FUNCTION public.sync_org_unit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare u record; d record;
begin
  if tg_op = 'UPDATE' and new.org_unit_id is distinct from old.org_unit_id then
    if new.org_unit_id is null then
      return new;
    end if;
    select * into u from org_units where id = new.org_unit_id;
    if u.kind = 'unit' then
      select * into d from org_units where id = u.parent_id;
      new.division := d.name; new.department := u.name;
    else
      new.division := u.name; new.department := '';
    end if;
  elsif tg_op = 'INSERT' or new.division is distinct from old.division or new.department is distinct from old.department then
    if new.org_unit_id is null or tg_op = 'UPDATE' then
      new.org_unit_id := public.resolve_org_unit(new.division, new.department);
    end if;
  end if;
  return new;
end $$;
DROP TRIGGER IF EXISTS sync_org_unit_trg ON public.profiles;
CREATE TRIGGER sync_org_unit_trg BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_org_unit();

-- Only admins may move people between units (prevents self-assignment into a team).
CREATE OR REPLACE FUNCTION public.protect_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(),'admin') then
    if new.approved is distinct from old.approved then new.approved := old.approved; end if;
    if new.org_unit_id is distinct from old.org_unit_id then new.org_unit_id := old.org_unit_id; end if;
  end if;
  return new;
end $function$;

-- Backfill from existing free-text data.
INSERT INTO public.org_units (name, kind)
SELECT DISTINCT ON (lower(trim(division))) trim(division), 'division'
FROM public.profiles WHERE coalesce(trim(division), '') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.org_units (name, kind, parent_id)
SELECT DISTINCT ON (d.id, lower(trim(p.department))) trim(p.department), 'unit', d.id
FROM public.profiles p
JOIN public.org_units d ON d.kind = 'division' AND lower(d.name) = lower(trim(p.division))
WHERE coalesce(trim(p.department), '') <> ''
ON CONFLICT DO NOTHING;

UPDATE public.profiles SET org_unit_id = public.resolve_org_unit(division, department) WHERE org_unit_id IS NULL;

-- Team roster visible to the caller's managed units (admin: everyone).
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (user_id uuid, full_name text, "position" text, division text, department text, org_unit_id uuid, approved boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select p.id, p.full_name, coalesce(p."position", ''), coalesce(p.division, ''), coalesce(p.department, ''), p.org_unit_id, p.approved
  from profiles p
  where auth.uid() is not null and p.id <> auth.uid() and public.can_manage_user(auth.uid(), p.id)
  order by p.division, p.department, p.full_name
$$;
GRANT EXECUTE ON FUNCTION public.get_team_members() TO authenticated;

-- Training status of team members, one row per enrollment.
CREATE OR REPLACE FUNCTION public.get_team_enrollments()
RETURNS TABLE (user_id uuid, course_id uuid, course_title text, session_id uuid, round_no int, starts_at timestamptz,
               require_pretest boolean, pre_done boolean, attended boolean, has_cert boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select e.user_id, e.course_id, c.title, e.session_id, s.round_no, s.starts_at, c.require_pretest,
         exists(select 1 from test_attempts t where t.user_id = e.user_id and t.course_id = e.course_id and t.kind = 'pre'),
         exists(select 1 from attendance a where a.user_id = e.user_id and a.course_id = e.course_id),
         exists(select 1 from certificates ce where ce.user_id = e.user_id and ce.course_id = e.course_id)
  from enrollments e
  join courses c on c.id = e.course_id
  left join course_sessions s on s.id = e.session_id
  where auth.uid() is not null and e.user_id <> auth.uid() and public.can_manage_user(auth.uid(), e.user_id)
  order by c.title, s.round_no nulls first
$$;
GRANT EXECUTE ON FUNCTION public.get_team_enrollments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid, uuid) TO authenticated;

-- Renaming a unit/division keeps members' legacy text columns in step.
CREATE OR REPLACE FUNCTION public.org_unit_renamed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if new.name is distinct from old.name then
    if new.kind = 'division' then
      update profiles p set division = new.name
       where p.org_unit_id = new.id or p.org_unit_id in (select id from org_units where parent_id = new.id);
    else
      update profiles set department = new.name where org_unit_id = new.id;
    end if;
  end if;
  return new;
end $$;
DROP TRIGGER IF EXISTS org_unit_renamed_trg ON public.org_units;
CREATE TRIGGER org_unit_renamed_trg AFTER UPDATE OF name ON public.org_units FOR EACH ROW EXECUTE FUNCTION public.org_unit_renamed();
