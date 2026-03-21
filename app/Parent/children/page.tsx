import { redirect } from "next/navigation";

export default function Children() {
  redirect("/Parent/profile");
}
