import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Guards the server-side rules that scoring, certificates, check-in and access depend on.
const dir = "drizzle/migrations";
const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");

describe("server-side training rules", () => {
  it("exposes grading, check-in and report functions", () => {
    for (const fn of ["submit_test", "get_test_questions", "check_in", "staff_check_in", "can_access_course", "report_overview", "report_rows"]) {
      expect(types).toContain(`${fn}: {`);
    }
  });
  it("never sends correct answers to learners", () => {
    const block = types.slice(types.indexOf("get_test_questions: {"), types.indexOf("get_test_questions: {") + 600);
    expect(block).not.toContain("correct_index");
  });
  it("restricts course files to staff or learners of that course", () => {
    expect(sql).toMatch(/course files read[\s\S]*is_staff[\s\S]*can_access_course/);
  });
  it("keeps staff check-in authorised and idempotent", () => {
    expect(sql).toMatch(/staff_check_in[\s\S]*can_edit_course[\s\S]*ON CONFLICT \(course_id, user_id\) DO NOTHING/);
  });
  it("limits report data to staff", () => {
    expect(sql).toMatch(/report_overview[\s\S]*is_staff\(auth\.uid\(\)\)/);
    expect(sql).toMatch(/report_rows[\s\S]*is_staff\(auth\.uid\(\)\)/);
  });
  it("issues certificates only through the server-side requirement check", () => {
    expect(sql).toMatch(/try_issue_certificate[\s\S]*issue_certificate[\s\S]*require_posttest[\s\S]*require_survey/);
    expect(sql).toMatch(/test disabled for this course/);
  });
});
