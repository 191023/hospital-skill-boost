import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type QueuedCheckin = {
  id: string;
  courseId: string;
  code: string;
  timestamp: string;
  userName?: string;
  courseTitle?: string;
  status: "pending" | "syncing" | "failed" | "synced";
  error?: string;
};

const STORAGE_KEY = "hospital_offline_checkin_queue";

export function getOfflineQueue(): QueuedCheckin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedCheckin[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    // Trigger custom event for cross-component reactive updates
    window.dispatchEvent(new CustomEvent("hospital:offline-queue-changed", { detail: queue }));
  } catch (err) {
    console.error("Failed to save offline check-in queue:", err);
  }
}

export function enqueueOfflineCheckin(
  courseId: string,
  code: string,
  metadata?: { userName?: string; courseTitle?: string }
): QueuedCheckin {
  const queue = getOfflineQueue();

  // Avoid duplicate queue entries for the exact same course & code
  const existing = queue.find((q) => q.courseId === courseId && q.code.toUpperCase() === code.toUpperCase());
  if (existing) {
    return existing;
  }

  const newItem: QueuedCheckin = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    courseId,
    code: code.trim(),
    timestamp: new Date().toISOString(),
    userName: metadata?.userName,
    courseTitle: metadata?.courseTitle,
    status: "pending",
  };

  queue.push(newItem);
  saveOfflineQueue(queue);
  return newItem;
}

export async function syncOfflineQueue(): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const remainingQueue: QueuedCheckin[] = [];

  for (const item of queue) {
    try {
      const { error } = await supabase.rpc("check_in", {
        _course: item.courseId,
        _code: item.code,
      });

      if (!error) {
        syncedCount++;
      } else {
        const msg = error.message.toLowerCase();
        // If already checked in or code expired, consider handled and don't stall the queue
        if (msg.includes("already") || msg.includes("ลงทะเบียนแล้ว") || msg.includes("เช็คชื่อแล้ว")) {
          syncedCount++;
        } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch")) {
          // Genuine network error, retain in queue
          remainingQueue.push(item);
          failedCount++;
        } else {
          // Other logical error (e.g. invalid code), retain with error message
          remainingQueue.push({ ...item, status: "failed", error: error.message });
          failedCount++;
        }
      }
    } catch (err) {
      remainingQueue.push(item);
      failedCount++;
    }
  }

  saveOfflineQueue(remainingQueue);

  if (syncedCount > 0) {
    toast.success(`ซิงค์ข้อมูลการเช็คชื่อออฟไลน์สำเร็จแล้ว (${syncedCount} รายการ) 📶✓`);
  }

  return { syncedCount, failedCount };
}

// Global auto-sync setup
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Small delay to allow connection stabilization
    setTimeout(() => {
      syncOfflineQueue();
    }, 1500);
  });
}

