-- Migration: Add ai_config default to system_settings
INSERT INTO public.system_settings (key, value)
VALUES (
  'ai_config',
  jsonb_build_object(
    'provider', 'gemini',
    'api_key', '',
    'model', 'gemini-1.5-flash',
    'enabled', false
  )
)
ON CONFLICT (key) DO NOTHING;
