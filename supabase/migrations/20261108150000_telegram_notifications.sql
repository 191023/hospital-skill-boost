-- Migration: Add Telegram configuration, user telegram fields, and notification logs
-- File: supabase/migrations/20261108150000_telegram_notifications.sql

-- 1. Initialize telegram_config in system_settings
INSERT INTO public.system_settings (key, value)
VALUES (
  'telegram_config',
  jsonb_build_object(
    'enabled', false,
    'bot_token', '',
    'bot_username', '',
    'default_chat_id', '',
    'channels', jsonb_build_object(
      'announcement', '',
      'leaders', '',
      'admin_hr', ''
    ),
    'events', jsonb_build_object(
      'new_course_published', jsonb_build_object('enabled', true, 'target', 'announcement'),
      'session_reminder_24h', jsonb_build_object('enabled', true, 'target', 'direct'),
      'session_reminder_3h', jsonb_build_object('enabled', false, 'target', 'direct'),
      'posttest_reminder', jsonb_build_object('enabled', true, 'target', 'direct'),
      'certificate_issued', jsonb_build_object('enabled', true, 'target', 'direct'),
      'dept_allocation_reminder', jsonb_build_object('enabled', true, 'target', 'leaders'),
      'session_checkin_summary', jsonb_build_object('enabled', true, 'target', 'admin_hr')
    )
  )
)
ON CONFLICT (key) DO NOTHING;

-- 2. Add Telegram integration fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON public.profiles(telegram_chat_id);

-- 3. Create notification_logs table for audit & troubleshooting
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'telegram',
  event_type text NOT NULL,
  recipient_chat_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message_title text,
  message_body text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type ON public.notification_logs(event_type);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notification logs" ON public.notification_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow insert notification logs" ON public.notification_logs
  FOR INSERT WITH CHECK (true);
