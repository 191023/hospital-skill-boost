<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Signed-in app pages live under src/routes/_authenticated/ (client-only, gated); public pages are top-level — keeps Supabase localStorage sessions working.
- Test grading and certificate issuing happen only in DB functions `submit_test` / `get_test_questions` — correct answers never reach the browser.
- Roles live in `user_roles` (admin/instructor/learner); approval flag lives on `profiles` guarded by a trigger — prevents self-escalation.
- Admin-only user creation uses a server function with the admin client after a has_role check.
- Course files go in the private `course-files` bucket and are shown via signed URLs — workspace blocks public buckets.
- Member history is written by DB triggers into `member_audit_log` (admin-read only); admin server fns re-attribute admin-created rows — keeps the log tamper-proof.
- AI calls go through `src/lib/ai.server.ts` (Lovable AI Gateway, Responses API), invoked only from server functions — keeps the key server-side.
- Certificate previews and issued certificates use the shared `CertificateDesign` component — keeps on-screen, print, and saved branding layouts consistent.
- Course rounds live in `course_sessions` (one row per round with its own check-in code); enrollments/attendance carry an optional session_id, set via `choose_session` / `check_in` DB functions — keeps capacity checks server-side.
- The staff training-room view lazy-loads React Three Fiber on a standalone authenticated route and visualizes ordered enrollments without persisting seats; attendance is read through existing RLS with polling — preserves enrollment rules and avoids exposing roster data to learners.
