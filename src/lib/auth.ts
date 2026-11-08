import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "instructor" | "learner";

export type Me = {
  id: string;
  email: string;
  full_name: string;
  division: string;
  department: string;
  position: string;
  license_no?: string;
  approved: boolean;
  roles: Role[];
  isAdmin: boolean;
  isStaff: boolean;
  isTeamManager: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: p }, { data: r }, { data: tm }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.rpc("is_team_manager", { _user: u.user.id }),
      ]);
      const roles = (r ?? []).map((x) => x.role as Role);
      return {
        id: u.user.id,
        email: u.user.email ?? "",
        full_name: p?.full_name ?? "",
        division: p?.division ?? "",
        department: p?.department ?? "",
        position: p?.position ?? "",
        license_no: (p as { license_no?: string })?.license_no ?? "",
        approved: p?.approved ?? false,
        roles,
        isAdmin: roles.includes("admin"),
        isStaff: roles.includes("admin") || roles.includes("instructor"),
        isTeamManager: !!tm,
      };
    },
  });
}

export const roleLabel: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  instructor: "วิทยากร",
  learner: "ผู้เรียน",
};


export async function fileUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/") || path.startsWith("data:")) return path;
  const { data } = await supabase.storage.from("course-files").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
