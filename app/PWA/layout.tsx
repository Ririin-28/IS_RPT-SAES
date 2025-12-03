// app/PWA/layout.tsx
export default function PWALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full overflow-hidden bg-white">
      {children}
    </div>
  );
}