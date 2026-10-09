import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const member = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1).max(200),
  division: z.string().max(100),
  department: z.string().max(100),
  position: z.string().max(100),
  role: z.enum(["learner", "instructor", "admin"]),
});
type Member = z.infer<typeof member>;

async function createOne(adminId: string, data: Member) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.full_name, division: data.division, department: data.department, position: data.position },
  });
  if (error) throw new Error(error.message);
  const id = created.user.id;
  await supabaseAdmin.from("profiles").update({ approved: true }).eq("id", id);
  if (data.role !== "learner") await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.role });
  await supabaseAdmin.from("member_audit_log").update({ actor_id: adminId, action: "created_by_admin" }).eq("target_id", id).eq("action", "created");
  return id;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
}

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => member.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    return { id: await createOne(context.userId, data) };
  });

export const importMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ rows: z.array(member).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const r of data.rows) {
      try {
        await createOne(context.userId, r);
        results.push({ email: r.email, ok: true });
      } catch (e) {
        results.push({ email: r.email, ok: false, error: (e as Error).message });
      }
    }
    return { results };
  });
