import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/checkin/$courseId/$code")({
  head: () => ({
    meta: [
      { title: "เช็คชื่อเข้าอบรม — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "สแกนเพื่อเช็คชื่อเข้าอบรมแบบ on-site โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "เช็คชื่อเข้าอบรม — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "สแกนเพื่อเช็คชื่อเข้าอบรมแบบ on-site" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checkin,
});

function Checkin() {
  const { courseId, code } = Route.useParams();
  useEffect(() => {
    const target = `/attend/${courseId}/${encodeURIComponent(code)}`;
    sessionStorage.setItem("after-auth", target);
    window.location.replace(target);
  }, [courseId, code]);
  return <div className="grid min-h-screen place-items-center text-muted-foreground">กำลังเช็คชื่อ...</div>;
}
