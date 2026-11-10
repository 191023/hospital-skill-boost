-- Migration: Fix lessons write RLS policy to filter out soft-deleted records
-- File: supabase/migrations/20261110220000_fix_lessons_soft_delete_rls.sql

DROP POLICY IF EXISTS "lessons write" ON public.lessons;

CREATE POLICY "lessons write" ON public.lessons
  FOR ALL
  TO authenticated
  USING (public.can_edit_course(course_id) AND (deleted_at IS NULL))
  WITH CHECK (public.can_edit_course(course_id));
