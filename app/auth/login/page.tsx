import Login from "@/modules/Auth/login/login";

export default function LoginPage() {
  return (
    <Login
      infoMessage="For teacher, principal, and master teacher accounts. Parent accounts must use the RPT Portal PWA."
      disallowRole="parent"
    />
  );
}
