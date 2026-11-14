-- Add optional image_url and video_url to exam questions
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text;

-- Update get_test_questions RPC to return image_url and video_url while keeping correct_index hidden on server
DROP FUNCTION IF EXISTS public.get_test_questions(uuid);

CREATE OR REPLACE FUNCTION public.get_test_questions(_course uuid)
RETURNS TABLE(
  id uuid,
  question text,
  options jsonb,
  image_url text,
  video_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, question, options, image_url, video_url
  FROM public.questions
  WHERE course_id = _course
    AND deleted_at IS NULL
  ORDER BY position;
$function$;

GRANT EXECUTE ON FUNCTION public.get_test_questions(uuid) TO anon, authenticated, service_role;
