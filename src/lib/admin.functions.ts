import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1).max(200),
        department: z.string().max(100),
        position: z.string().max(100),
        role: z.enum(["learner", "instructor", "admin"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, department: data.department, position: data.position },
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ approved: true }).eq("id", created.user.id);
    if (data.role !== "learner") {
      await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    }
    return { id: created.user.id };
  });
