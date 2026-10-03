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

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-2xl bg-brand-gradient text-lg font-bold text-primary-foreground shadow-brand">อ</div>
      <div>
        <div className="text-sm font-bold leading-tight">โรงพยาบาลโอเวอร์บรุ๊ค</div>
        <div className="text-[11px] text-primary-deep/70">ศูนย์พัฒนาศักยภาพบุคลากร</div>
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
