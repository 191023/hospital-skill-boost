DROP POLICY IF EXISTS "course files read" ON storage.objects;
CREATE POLICY "course files read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-files' AND (
    public.is_staff(auth.uid()) OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$' AND (
        (public.is_approved(auth.uid()) AND public.can_access_course(((storage.foldername(name))[1])::uuid, auth.uid()))
        OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.user_id = auth.uid() AND e.course_id = ((storage.foldername(name))[1])::uuid)
        OR EXISTS (SELECT 1 FROM public.certificates c WHERE c.user_id = auth.uid() AND c.course_id = ((storage.foldername(name))[1])::uuid)
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.report_overview(_year integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare r jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not allowed'; end if;
  with c as (select id, title, training_year from courses where _year is null or training_year = _year),
  e as (select e.user_id, e.course_id, p.division, p.department,
          exists(select 1 from certificates x where x.user_id=e.user_id and x.course_id=e.course_id) passed
        from enrollments e join c on c.id=e.course_id left join profiles p on p.id=e.user_id),
  t as (select a.* from test_attempts a join c on c.id=a.course_id)
  select jsonb_build_object(
    'years', (select coalesce(jsonb_agg(distinct training_year order by training_year desc), '[]') from courses),
    'learners', (select count(distinct user_id) from e),
    'enrollments', (select count(*) from e),
    'passed', (select count(*) from e where passed),
    'certificates', (select count(*) from certificates x join c on c.id=x.course_id),
    'course_count', (select count(*) from c),
    'pre_avg', (select coalesce(round(avg(percent),1),0) from t where kind='pre'),
    'post_avg', (select coalesce(round(avg(percent),1),0) from t where kind='post'),
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'training_year',c.training_year,
        'enrolled',(select count(*) from e where e.course_id=c.id),
        'passed',(select count(*) from e where e.course_id=c.id and passed),
        'pre',(select coalesce(round(avg(percent),1),0) from t where t.course_id=c.id and kind='pre'),
        'post',(select coalesce(round(avg(percent),1),0) from t where t.course_id=c.id and kind='post')) order by c.title), '[]') from c),
    'division', (select coalesce(jsonb_agg(jsonb_build_object('name',n,'enrolled',en,'passed',pa) order by n), '[]') from
        (select coalesce(nullif(division,''),'ไม่ระบุ') n, count(*) en, count(*) filter (where passed) pa from e group by 1) g),
    'department', (select coalesce(jsonb_agg(jsonb_build_object('name',n,'enrolled',en,'passed',pa) order by n), '[]') from
        (select coalesce(nullif(department,''),'ไม่ระบุ') n, count(*) en, count(*) filter (where passed) pa from e group by 1) g)
  ) into r;
  return r;
end $$;

CREATE OR REPLACE FUNCTION public.report_rows(_year integer DEFAULT NULL)
RETURNS TABLE(full_name text, division text, department text, course_title text, training_year integer, pre numeric, post numeric, cert_no text, issued_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select p.full_name, p.division, p.department, c.title, c.training_year,
    (select percent from test_attempts a where a.user_id=e.user_id and a.course_id=e.course_id and kind='pre' order by created_at limit 1),
    (select max(percent) from test_attempts a where a.user_id=e.user_id and a.course_id=e.course_id and kind='post'),
    x.cert_no, x.issued_at
  from enrollments e join courses c on c.id=e.course_id
  left join profiles p on p.id=e.user_id
  left join certificates x on x.user_id=e.user_id and x.course_id=e.course_id
  where public.is_staff(auth.uid()) and (_year is null or c.training_year=_year)
  order by c.title, p.full_name, e.id
$$;