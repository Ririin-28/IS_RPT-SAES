import Login from "@/modules/Auth/login/login";

export default function AdminLoginPage() {
  return <Login infoMessage="This login is only for the Super Admin." requireItAdminId />;
}
