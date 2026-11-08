import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { getOfflineQueue, syncOfflineQueue, type QueuedCheckin } from "@/lib/offline-sync";

export function OfflineSyncIndicator({ className = "" }: { className?: string }) {
  const [queue, setQueue] = useState<QueuedCheckin[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setQueue(getOfflineQueue());

    const updateListener = () => {
      setQueue(getOfflineQueue());
    };

    window.addEventListener("hospital:offline-queue-changed", updateListener);
    window.addEventListener("online", updateListener);
    window.addEventListener("offline", updateListener);

    return () => {
      window.removeEventListener("hospital:offline-queue-changed", updateListener);
      window.removeEventListener("online", updateListener);
      window.removeEventListener("offline", updateListener);
    };
  }, []);

  if (queue.length === 0) return null;

  async function handleSync() {
    setSyncing(true);
    await syncOfflineQueue();
    setSyncing(false);
    setQueue(getOfflineQueue());
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 backdrop-blur-md animate-pulse ${className}`}
      role="status"
    >
      <WifiOff className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span>{queue.length} เช็คชื่อรอซิงค์ (จุดอับสัญญาณ)</span>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="rounded-lg bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs hover:bg-amber-600 disabled:opacity-50 transition"
      >
        {syncing ? "กำลังซิงค์..." : "ซิงค์ทันที"}
      </button>
    </div>
  );
}

