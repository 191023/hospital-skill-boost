import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Guards the server-side rules that scoring, certificates, check-in and access depend on.
const dir = "drizzle/migrations";
const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");

describe("server-side training rules", () => {
  it("exposes grading, check-in and report functions", () => {
    for (const fn of ["submit_test", "get_test_questions", "check_in", "staff_check_in", "can_access_course", "report_overview", "report_rows", "get_course_item_analytics"]) {
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
  it("protects trainee privacy in get_session_roster and validates access", () => {
    expect(types).toContain("get_session_roster: {");
    expect(sql).toMatch(/get_session_roster[\s\S]*is_staff\(auth\.uid\(\)\)[\s\S]*can_access_course/);
    // Ensure sensitive fields are not exposed in session roster
    const rosterTypeBlock = types.slice(types.indexOf("get_session_roster: {"), types.indexOf("get_session_roster: {") + 400);
    expect(rosterTypeBlock).not.toContain("email");
    expect(rosterTypeBlock).not.toContain("phone");
    expect(rosterTypeBlock).toContain("full_name");
    expect(rosterTypeBlock).toContain("division");
    expect(rosterTypeBlock).toContain("department");
  });
  it("enforces session capacity and enrollment via choose_session", () => {
    expect(types).toContain("choose_session: {");
    expect(sql).toMatch(/choose_session[\s\S]*for update[\s\S]*รอบนี้ที่นั่งเต็มแล้ว/);
  });
  it("enforces attendance check-in before post-test and certificate issuance for classroom courses", () => {
    expect(sql).toMatch(/_kind = 'post'[\s\S]*course_sessions[\s\S]*attendance[\s\S]*เช็คชื่อเข้าห้องอบรมก่อนทำแบบทดสอบหลังเรียน/);
    expect(sql).toMatch(/try_issue_certificate[\s\S]*course_sessions[\s\S]*attendance/);
  });
  it("scopes team data to managed units and blocks self-assignment into a team", () => {
    expect(types).toContain("get_team_members: {");
    expect(sql).toMatch(/get_team_members[\s\S]*can_manage_user\(auth\.uid\(\), p\.id\)/);
    expect(sql).toMatch(/get_team_enrollments[\s\S]*can_manage_user\(auth\.uid\(\), e\.user_id\)/);
    expect(sql).toMatch(/org managers admin write[\s\S]*has_role\(auth\.uid\(\), 'admin'\)/);
    expect(sql).toMatch(/protect_profile[\s\S]*new\.org_unit_id := old\.org_unit_id/);
    const block = types.slice(types.indexOf("get_team_members: {"), types.indexOf("get_team_members: {") + 400);
    expect(block).not.toContain("email");
  });
  it("authorizes manager batch assignment with can_manage_user and capacity checks", () => {
    expect(types).toContain("manager_assign_course: {");
    expect(sql).toMatch(/manager_assign_course[\s\S]*can_manage_user[\s\S]*can_access_course[\s\S]*member_audit_log/);
  });
  it("exposes calendar sessions with soft-delete filter and seat quotas", () => {
    expect(types).toContain("get_calendar_sessions: {");
    expect(sql).toMatch(/get_calendar_sessions[\s\S]*s\.deleted_at IS NULL[\s\S]*c\.deleted_at IS NULL/);
    expect(sql).toMatch(/get_calendar_sessions[\s\S]*taken_seats[\s\S]*team_attendees_count/);
  });
});
