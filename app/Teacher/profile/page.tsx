import { Suspense } from "react";
import TeacherProfile from "@/modules/Teacher/profile/profile";

export default function Profile() {
  return (
    <Suspense fallback={null}>
      <TeacherProfile />
    </Suspense>
  );
}
