import LeftNavbar from "@/components/LeftNavbar";
import TopBar from "@/components/TopBar";
import AuthGuard from "@/components/AuthGuard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#eef0f6]">
        <LeftNavbar />
        <main className="flex min-h-screen flex-1 flex-col pl-[84px] transition-all duration-300 peer-hover:pl-[300px]">
          <TopBar />
          <div className="flex-1 p-10">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
