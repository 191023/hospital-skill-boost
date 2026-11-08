import { describe, it, expect, beforeEach } from "vitest";
import {
  getOfflineQueue,
  saveOfflineQueue,
  enqueueOfflineCheckin,
  syncOfflineQueue,
} from "@/lib/offline-sync";

describe("Offline Check-in Queue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enqueues check-in item to localStorage", () => {
    const item = enqueueOfflineCheckin("course-123", "ABC12345", {
      userName: "สมชาย รักษาดี",
      courseTitle: "การดับเพลิงขั้นต้น",
    });

    expect(item.courseId).toBe("course-123");
    expect(item.code).toBe("ABC12345");
    expect(item.userName).toBe("สมชาย รักษาดี");

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].code).toBe("ABC12345");
  });

  it("prevents duplicate queue entries for the same course and code", () => {
    enqueueOfflineCheckin("course-123", "ABC12345");
    enqueueOfflineCheckin("course-123", "abc12345"); // case-insensitive check

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
  });

  it("handles empty queue gracefully on sync", async () => {
    const result = await syncOfflineQueue();
    expect(result.syncedCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });
});

