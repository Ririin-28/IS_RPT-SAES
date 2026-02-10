// app/PWA/layout.tsx
import PWARegister from "@/components/PWA/PWARegister";
export default function PWALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full overflow-hidden bg-white">
      <PWARegister />
      {children}
    </div>
  );
}