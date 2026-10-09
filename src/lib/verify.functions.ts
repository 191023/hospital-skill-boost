import { createServerFn } from "@tanstack/react-start";

// Public lookup by unguessable certificate number; returns only display-safe fields.
export const verifyCert = createServerFn({ method: "GET" })
  .validator((d: { certNo: string }) => ({ certNo: String(d.certNo ?? "").slice(0, 64) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin
      .from("certificates")
      .select("cert_no, issued_at, score, user_id, courses(title, hours, training_year)")
      .eq("cert_no", data.certNo)
      .maybeSingle();
    if (!c) return null;
    const { data: p } = await supabaseAdmin.from("profiles").select("full_name, division, department").eq("id", c.user_id).maybeSingle();
    const course = c.courses as unknown as { title: string; hours: number; training_year: number } | null;
    return {
      cert_no: c.cert_no,
      issued_at: c.issued_at,
      score: c.score,
      full_name: p?.full_name ?? "",
      division: p?.division ?? "",
      department: p?.department ?? "",
      course_title: course?.title ?? "",
      hours: course?.hours ?? 0,
      training_year: course?.training_year ?? null,
    };
  });
