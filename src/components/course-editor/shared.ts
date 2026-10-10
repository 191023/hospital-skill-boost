import { supabase } from "@/integrations/supabase/client";

export const inp = "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
export const btn = "rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand disabled:opacity-60";

export async function uploadCourseFile(file: File, courseId: string) {
  const path = `${courseId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("course-files").upload(path, file);
  if (error) throw error;
  return path;
}
