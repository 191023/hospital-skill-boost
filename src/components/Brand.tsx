import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import logo from "@/assets/obh-logo.png";
import c1 from "@/assets/cover-1.jpg";
import c2 from "@/assets/cover-2.jpg";
import c3 from "@/assets/cover-3.jpg";

export function Blobs() {
  return (
    <>
      <div className="pointer-events-none absolute -left-32 -top-40 size-[560px] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-1/3 size-[520px] rounded-full bg-mint/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 size-[480px] rounded-full bg-lilac/15 blur-3xl" />
    </>
  );
}

export function Brand({
  showLogo = true,
  subtitle,
}: {
  showLogo?: boolean;
  subtitle?: string;
}) {
  const { data: profile } = useQuery({
    queryKey: ["hospital-profile-brand"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "hospital_profile")
        .maybeSingle();
      return (data?.value ?? null) as {
        name_th?: string;
        center_name?: string;
        logo_url?: string;
      } | null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const [resolvedLogo, setResolvedLogo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (profile?.logo_url) {
      fileUrl(profile.logo_url).then((url) => {
        if (active) setResolvedLogo(url || logo);
      });
    } else {
      setResolvedLogo(logo);
    }
    return () => {
      active = false;
    };
  }, [profile?.logo_url]);

  const hospitalName = profile?.name_th || "โรงพยาบาลโอเวอร์บรุ๊ค";
  const centerName = subtitle || profile?.center_name || "ศูนย์พัฒนาศักยภาพบุคลากร";

  return (
    <div className="flex items-center gap-3">
      {showLogo ? (
        <img
          src={resolvedLogo || logo}
          alt={hospitalName}
          className="size-10 object-contain drop-shadow-sm transition-transform hover:scale-105"
          width={40}
          height={40}
        />
      ) : (
        <div className="grid size-10 place-items-center rounded-2xl bg-brand-gradient text-lg font-bold text-primary-foreground shadow-brand">
          อ
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-bold leading-tight text-foreground">
          {hospitalName}
        </div>
        <div className="truncate text-[11px] font-medium text-primary-deep/75">
          {centerName}
        </div>
      </div>
    </div>
  );
}

const covers = [c1, c2, c3];
export function coverFor(id: string, url?: string | null) {
  if (url) return url;
  let h = 0;
  for (const ch of id) h = (h + ch.charCodeAt(0)) % 997;
  return covers[h % covers.length];
}

const tones = ["text-primary", "text-mint", "text-coral", "text-amber"];
export function toneFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h + ch.charCodeAt(0)) % 997;
  return tones[h % tones.length];
}
