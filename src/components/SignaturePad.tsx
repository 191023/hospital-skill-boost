import { useEffect, useRef, useState } from "react";
import { Eraser, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignaturePad({ onSave, onCancel }: { onSave: (file: File) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    c.width = 1200; c.height = 450;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(c).color || "#0b2a5b";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1200, y: ((e.clientY - r.top) / r.height) * 450 };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!; const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    setEmpty(false);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!; const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function clear() {
    const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true);
  }
  function save() {
    ref.current!.toBlob((b) => { if (b) onSave(new File([b], "signature.png", { type: "image/png" })); }, "image/png");
  }

  return (
    <div className="mt-3 space-y-2">
      <canvas
        ref={ref}
        aria-label="พื้นที่เซ็นลายเซ็น"
        className="aspect-[8/3] w-full touch-none rounded-xl border-2 border-dashed bg-card text-primary-deep"
        onPointerDown={down} onPointerMove={move}
        onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)}
      />
      <p className="text-[11px] text-muted-foreground">ใช้นิ้วหรือเมาส์เซ็นในกรอบ</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={clear}><Eraser aria-hidden="true" />ล้าง</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}><X aria-hidden="true" />ยกเลิก</Button>
        <Button type="button" size="sm" className="ml-auto" disabled={empty} onClick={save}><Check aria-hidden="true" />ใช้ลายเซ็นนี้</Button>
      </div>
    </div>
  );
}
