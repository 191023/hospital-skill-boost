import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/join/$courseId")({
  head: () => ({
    meta: [
      { title: "ลงทะเบียนหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "สแกนเพื่อลงทะเบียนหลักสูตรอบรมออนไลน์ โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "ลงทะเบียนหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "สแกนเพื่อลงทะเบียนหลักสูตรอบรมออนไลน์" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Join,
});

function Join() {
  const { courseId } = Route.useParams();
  useEffect(() => {
    // Remember where to go after sign-in, then go to the course with auto-enroll.
    sessionStorage.setItem("after-auth", `/courses/${courseId}?join=1`);
    window.location.replace(`/courses/${courseId}?join=1`);
  }, [courseId]);
  return <div className="grid min-h-screen place-items-center text-muted-foreground">กำลังเปิดหลักสูตร...</div>;
}
