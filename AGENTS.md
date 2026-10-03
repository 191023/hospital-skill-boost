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
