import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRImg({ value, size = 160, className = "" }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: "#1e3a8a", light: "#ffffff" } }).then(setSrc).catch(() => setSrc(""));
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} className={`rounded-lg bg-muted ${className}`} />;
  return <img src={src} width={size} height={size} alt="QR code" className={`rounded-lg bg-white ${className}`} />;
}

export function origin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}
