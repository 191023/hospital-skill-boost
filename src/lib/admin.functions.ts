import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const member = z.object({
  email: z.string().email(),
  employee_id: z.string().optional(),
  password: z.string().min(6),
  full_name: z.string().min(1).max(200),
  division: z.string().max(100),
  department: z.string().max(100),
  position: z.string().max(100),
  role: z.enum(["learner", "instructor", "admin"]),
  manager_role: z.enum(["none", "division_head", "department_head"]).optional(),
});
type Member = z.infer<typeof member>;

async function resolveOrgUnitIds(
  supabaseAdmin: any,
  divisionName: string,
  departmentName: string,
  cache?: Map<string, { id: string; kind: string; parent_id: string | null }>,
): Promise<{ divId: string | null; deptId: string | null; targetUnitId: string | null }> {
  const div = divisionName.trim();
  const dept = departmentName.trim();
  if (!div) return { divId: null, deptId: null, targetUnitId: null };

  let divId: string | null = null;
  const divKey = `div:${div}`;

  if (cache?.has(divKey)) {
    divId = cache.get(divKey)!.id;
  } else {
    let { data: divRow } = await supabaseAdmin
      .from("org_units")
      .select("id")
      .eq("kind", "division")
      .eq("name", div)
      .maybeSingle();

    if (!divRow) {
      const { data: createdDiv } = await supabaseAdmin
        .from("org_units")
        .insert({ name: div, kind: "division", parent_id: null })
        .select("id")
        .maybeSingle();
      divRow = createdDiv;
    }
    divId = divRow?.id ?? null;
    if (divId && cache) cache.set(divKey, { id: divId, kind: "division", parent_id: null });
  }

  let deptId: string | null = null;
  if (divId && dept) {
    const deptKey = `unit:${divId}:${dept}`;
    if (cache?.has(deptKey)) {
      deptId = cache.get(deptKey)!.id;
    } else {
      let { data: deptRow } = await supabaseAdmin
        .from("org_units")
        .select("id")
        .eq("kind", "unit")
        .eq("parent_id", divId)
        .eq("name", dept)
        .maybeSingle();

      if (!deptRow) {
        const { data: createdDept } = await supabaseAdmin
          .from("org_units")
          .insert({ name: dept, kind: "unit", parent_id: divId })
          .select("id")
          .maybeSingle();
        deptRow = createdDept;
      }
      deptId = deptRow?.id ?? null;
      if (deptId && cache) cache.set(deptKey, { id: deptId, kind: "unit", parent_id: divId });
    }
  }

  return {
    divId,
    deptId,
    targetUnitId: deptId || divId,
  };
}

async function createOne(
  adminId: string,
  data: Member,
  unitCache?: Map<string, { id: string; kind: string; parent_id: string | null }>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { divId, deptId, targetUnitId } = await resolveOrgUnitIds(
    supabaseAdmin,
    data.division,
    data.department,
    unitCache,
  );

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      division: data.division,
      department: data.department,
      position: data.position,
      employee_id: data.employee_id,
      approved: true,
    },
  });

  if (error) {
    // If user already exists in auth.users, heal/sync their profile & org_unit_id instead of failing
    if (
      error.message.toLowerCase().includes("already") ||
      error.message.toLowerCase().includes("registered") ||
      error.message.toLowerCase().includes("exists")
    ) {
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (existingProfile?.id) {
        await supabaseAdmin
          .from("profiles")
          .update({
            full_name: data.full_name,
            division: data.division,
            department: data.department,
            position: data.position,
            approved: true,
            ...(data.employee_id ? { employee_id: data.employee_id } : {}),
            ...(targetUnitId ? { org_unit_id: targetUnitId } : {}),
          })
          .eq("id", existingProfile.id);
        return existingProfile.id;
      }
    }
    throw new Error(error.message);
  }

  const id = created.user.id;
  await supabaseAdmin
    .from("profiles")
    .update({
      full_name: data.full_name,
      division: data.division,
      department: data.department,
      position: data.position,
      approved: true,
      ...(data.employee_id ? { employee_id: data.employee_id } : {}),
      ...(targetUnitId ? { org_unit_id: targetUnitId } : {}),
    })
    .eq("id", id);

  if (data.role !== "learner") {
    await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: data.role }, { onConflict: "user_id,role" });
  }

  if (data.manager_role === "division_head" && divId) {
    await supabaseAdmin
      .from("org_unit_managers")
      .upsert({ user_id: id, org_unit_id: divId }, { onConflict: "user_id,org_unit_id" });
  } else if (data.manager_role === "department_head" && (deptId || divId)) {
    await supabaseAdmin
      .from("org_unit_managers")
      .upsert({ user_id: id, org_unit_id: deptId || divId }, { onConflict: "user_id,org_unit_id" });
  }

  await supabaseAdmin
    .from("member_audit_log")
    .update({ actor_id: adminId, action: "created_by_admin" })
    .eq("target_id", id)
    .eq("action", "created");
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const unitCache = new Map<string, { id: string; kind: string; parent_id: string | null }>();
    const { data: allUnits } = await supabaseAdmin.from("org_units").select("id, name, kind, parent_id");
    for (const u of allUnits ?? []) {
      if (u.kind === "division") unitCache.set(`div:${u.name}`, u);
      else if (u.kind === "unit" && u.parent_id) unitCache.set(`unit:${u.parent_id}:${u.name}`, u);
    }

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const r of data.rows) {
      try {
        await createOne(context.userId, r, unitCache);
        results.push({ email: r.email, ok: true });
      } catch (e) {
        results.push({ email: r.email, ok: false, error: (e as Error).message });
      }
    }
    return { results };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        newPassword: z.string().min(6, "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร"),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("member_audit_log").insert({
      actor_id: context.userId,
      target_id: data.userId,
      action: "password_reset_by_admin",
      metadata: { reset_at: new Date().toISOString() },
    });

    return { success: true };
  });
