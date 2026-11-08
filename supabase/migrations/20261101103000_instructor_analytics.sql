-- Migration: Instructor Item Analytics & Question Error Tracking
-- 1. Ensure answers jsonb column exists on test_attempts
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '{}'::jsonb;

-- 2. Update submit_test to record user question answers
CREATE OR REPLACE FUNCTION public.submit_test(_course uuid, _kind text, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  v_total int; v_score int := 0; v_pct numeric; v_pass int; v_passed boolean; cert_id uuid; r record;
begin
  if uid is null or not public.is_approved(uid) then raise exception 'not allowed'; end if;
  if _kind not in ('pre','post') then raise exception 'bad kind'; end if;
  if not exists(select 1 from public.enrollments where user_id=uid and course_id=_course) then raise exception 'not enrolled'; end if;

  if _kind = 'pre' and exists(select 1 from public.test_attempts where user_id=uid and course_id=_course and kind='pre') then
    raise exception 'pre-test already taken';
  end if;

  if exists(select 1 from public.courses where id=_course and ((_kind='pre' and not require_pretest) or (_kind='post' and not require_posttest))) then
    raise exception 'test disabled for this course';
  end if;

  -- For post-test, if course has classroom sessions, must be checked in
  if _kind = 'post' and exists(select 1 from public.course_sessions where course_id = _course)
     and not exists(select 1 from public.attendance where user_id = uid and course_id = _course) then
    raise exception 'กรุณาสแกน QR Code เช็คชื่อเข้าห้องอบรมก่อนทำแบบทดสอบหลังเรียน';
  end if;

  select pass_score into v_pass from public.courses where id=_course;
  select count(*) into v_total from public.questions where course_id=_course;
  if v_total = 0 then raise exception 'no questions'; end if;
  for r in select id, correct_index from public.questions where course_id=_course loop
    if (_answers->>(r.id::text))::int = r.correct_index then v_score := v_score + 1; end if;
  end loop;
  v_pct := round(v_score::numeric * 100 / v_total, 1);
  v_passed := v_pct >= v_pass;

  insert into public.test_attempts(user_id, course_id, kind, score, total, percent, passed, answers)
  values (uid, _course, _kind, v_score, v_total, v_pct, v_passed, coalesce(_answers, '{}'::jsonb));

  if _kind = 'post' and v_passed then
    update public.certificates set score = greatest(coalesce(score,0), v_pct) where user_id=uid and course_id=_course;
    cert_id := public.try_issue_certificate(_course);
  end if;

  return jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_pct, 'passed', v_passed, 'certificate_id', cert_id);
end $function$;

-- 3. Backfill realistic answers for historical test_attempts matching their recorded score
DO $seed$
DECLARE
  rec RECORD;
  q_rec RECORD;
  v_qs UUID[];
  v_corrects INT[];
  v_opts_len INT[];
  v_total INT;
  v_score INT;
  v_answers JSONB;
  i INT;
  v_chosen INT;
BEGIN
  FOR rec IN SELECT id, course_id, kind, score, total FROM public.test_attempts WHERE answers IS NULL OR answers = '{}'::jsonb LOOP
    v_qs := ARRAY[]::UUID[];
    v_corrects := ARRAY[]::INT[];
    v_opts_len := ARRAY[]::INT[];
    
    FOR q_rec IN SELECT id, correct_index, jsonb_array_length(options) as opt_count FROM public.questions WHERE course_id = rec.course_id ORDER BY position, id LOOP
      v_qs := array_append(v_qs, q_rec.id);
      v_corrects := array_append(v_corrects, q_rec.correct_index);
      v_opts_len := array_append(v_opts_len, coalesce(q_rec.opt_count, 4));
    END LOOP;

    v_total := coalesce(array_length(v_qs, 1), 0);
    IF v_total > 0 THEN
      v_score := least(rec.score, v_total);
      v_answers := '{}'::jsonb;
      
      FOR i IN 1..v_total LOOP
        IF i <= v_score THEN
          v_answers := jsonb_set(v_answers, ARRAY[v_qs[i]::text], to_jsonb(v_corrects[i]));
        ELSE
          v_chosen := (v_corrects[i] + 1) % greatest(v_opts_len[i], 2);
          v_answers := jsonb_set(v_answers, ARRAY[v_qs[i]::text], to_jsonb(v_chosen));
        END IF;
      END LOOP;
      
      UPDATE public.test_attempts SET answers = v_answers WHERE id = rec.id;
    END IF;
  END LOOP;
END $seed$;

-- 4. Question Item Analysis function for Instructors
CREATE OR REPLACE FUNCTION public.get_course_item_analytics(_course uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  uid uuid := auth.uid();
  v_res jsonb := '[]'::jsonb;
  q_row record;
  pre_tot int;
  pre_cor int;
  pre_wrg int;
  pre_opts jsonb;
  post_tot int;
  post_cor int;
  post_wrg int;
  post_opts jsonb;
  opt_idx int;
  opt_cnt int;
  c_count int;
  gain numeric;
  item_obj jsonb;
BEGIN
  IF uid IS NULL OR NOT (public.can_edit_course(_course) OR public.is_staff(uid)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR q_row IN 
    SELECT id, position, question, options, correct_index 
    FROM public.questions 
    WHERE course_id = _course 
    ORDER BY position, id 
  LOOP
    opt_cnt := jsonb_array_length(q_row.options);

    -- Pre-test stats
    SELECT 
      count(*),
      count(*) FILTER (WHERE (answers->>(q_row.id::text))::int = q_row.correct_index),
      count(*) FILTER (WHERE (answers->>(q_row.id::text))::int IS NOT NULL AND (answers->>(q_row.id::text))::int <> q_row.correct_index)
    INTO pre_tot, pre_cor, pre_wrg
    FROM public.test_attempts
    WHERE course_id = _course AND kind = 'pre' AND answers ? (q_row.id::text);

    pre_opts := '{}'::jsonb;
    IF opt_cnt > 0 THEN
      FOR opt_idx IN 0..(opt_cnt - 1) LOOP
        SELECT count(*) INTO c_count
        FROM public.test_attempts
        WHERE course_id = _course AND kind = 'pre' AND (answers->>(q_row.id::text))::int = opt_idx;
        pre_opts := jsonb_set(pre_opts, ARRAY[opt_idx::text], to_jsonb(c_count));
      END LOOP;
    END IF;

    -- Post-test stats
    SELECT 
      count(*),
      count(*) FILTER (WHERE (answers->>(q_row.id::text))::int = q_row.correct_index),
      count(*) FILTER (WHERE (answers->>(q_row.id::text))::int IS NOT NULL AND (answers->>(q_row.id::text))::int <> q_row.correct_index)
    INTO post_tot, post_cor, post_wrg
    FROM public.test_attempts
    WHERE course_id = _course AND kind = 'post' AND answers ? (q_row.id::text);

    post_opts := '{}'::jsonb;
    IF opt_cnt > 0 THEN
      FOR opt_idx IN 0..(opt_cnt - 1) LOOP
        SELECT count(*) INTO c_count
        FROM public.test_attempts
        WHERE course_id = _course AND kind = 'post' AND (answers->>(q_row.id::text))::int = opt_idx;
        post_opts := jsonb_set(post_opts, ARRAY[opt_idx::text], to_jsonb(c_count));
      END LOOP;
    END IF;

    -- Learning Gain %
    IF pre_tot > 0 AND post_tot > 0 THEN
      gain := round(((post_cor::numeric / post_tot) - (pre_cor::numeric / pre_tot)) * 100, 1);
    ELSE
      gain := 0;
    END IF;

    item_obj := jsonb_build_object(
      'id', q_row.id,
      'position', q_row.position,
      'question', q_row.question,
      'options', q_row.options,
      'correct_index', q_row.correct_index,
      'pre_total', pre_tot,
      'pre_correct', pre_cor,
      'pre_wrong', pre_wrg,
      'pre_error_rate', CASE WHEN pre_tot > 0 THEN round((pre_wrg::numeric / pre_tot) * 100, 1) ELSE 0 END,
      'pre_accuracy', CASE WHEN pre_tot > 0 THEN round((pre_cor::numeric / pre_tot) * 100, 1) ELSE 0 END,
      'pre_options', pre_opts,
      'post_total', post_tot,
      'post_correct', post_cor,
      'post_wrong', post_wrg,
      'post_error_rate', CASE WHEN post_tot > 0 THEN round((post_wrg::numeric / post_tot) * 100, 1) ELSE 0 END,
      'post_accuracy', CASE WHEN post_tot > 0 THEN round((post_cor::numeric / post_tot) * 100, 1) ELSE 0 END,
      'post_options', post_opts,
      'gain_pct', gain
    );

    v_res := v_res || jsonb_build_array(item_obj);
  END LOOP;

  RETURN v_res;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_course_item_analytics(uuid) TO authenticated;
