import { describe, it, expect } from "vitest";
import { getCourseAction } from "@/lib/data";

describe("getCourseAction", () => {
  it("suggests certificate when course is completed with cert", () => {
    const action = getCourseAction({
      id: "course-1",
      has_cert: true,
      certId: "cert-abc",
      has_sessions: false,
      session_id: null,
      require_pretest: true,
      pre_done: true,
      attended: true,
      total_lessons: 3,
      lessons_done: 3,
      require_posttest: true,
      post_done: true,
      require_survey: true,
      survey_done: true,
      enrolled: true,
    });

    expect(action.label).toBe("ดูใบประกาศนียบัตร");
    expect(action.tone).toBe("mint");
    expect(action.href).toBe("/certificates/cert-abc");
  });

  it("suggests choose session when user is not enrolled in classroom course with sessions", () => {
    const action = getCourseAction({
      id: "course-2",
      has_cert: false,
      has_sessions: true,
      session_id: null,
      require_pretest: false,
      pre_done: false,
      attended: false,
      training_type: "classroom",
      total_lessons: 0,
      lessons_done: 0,
      require_posttest: false,
      post_done: false,
      require_survey: false,
      survey_done: false,
      enrolled: false,
    });

    expect(action.label).toBe("เลือกรอบการอบรม");
    expect(action.tone).toBe("amber");
    expect(action.href).toBe("/courses/course-2");
  });

  it("suggests start course when user is not enrolled in online course", () => {
    const action = getCourseAction({
      id: "course-3",
      has_cert: false,
      has_sessions: false,
      session_id: null,
      require_pretest: true,
      pre_done: false,
      attended: false,
      training_type: "online",
      total_lessons: 2,
      lessons_done: 0,
      require_posttest: true,
      post_done: false,
      require_survey: false,
      survey_done: false,
      enrolled: false,
    });

    expect(action.label).toBe("เริ่มเข้าอบรมทันที");
    expect(action.tone).toBe("primary");
    expect(action.href).toBe("/courses/course-3");
  });

  it("suggests pre-test when enrolled and pre-test is required but not done", () => {
    const action = getCourseAction({
      id: "course-4",
      has_cert: false,
      has_sessions: false,
      session_id: null,
      require_pretest: true,
      pre_done: false,
      attended: false,
      training_type: "online",
      total_lessons: 2,
      lessons_done: 0,
      require_posttest: true,
      post_done: false,
      require_survey: false,
      survey_done: false,
      enrolled: true,
    });

    expect(action.label).toBe("ทำแบบทดสอบก่อนเรียน (Pre-test)");
    expect(action.tone).toBe("amber");
    expect(action.href).toBe("/courses/course-4/test/pre");
  });

  it("suggests post-test when enrolled and all lessons done", () => {
    const action = getCourseAction({
      id: "course-5",
      has_cert: false,
      has_sessions: false,
      session_id: null,
      require_pretest: true,
      pre_done: true,
      attended: false,
      training_type: "online",
      total_lessons: 2,
      lessons_done: 2,
      require_posttest: true,
      post_done: false,
      require_survey: false,
      survey_done: false,
      enrolled: true,
    });

    expect(action.label).toBe("ทำแบบทดสอบหลังเรียน (Post-test)");
    expect(action.tone).toBe("amber");
    expect(action.href).toBe("/courses/course-5/test/post");
  });
});

