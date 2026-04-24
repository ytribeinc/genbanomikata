import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SidebarNav } from "@/components/ui/SidebarNav";
import { DashboardHeader } from "@/components/ui/DashboardHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — desktop only (mobile is handled via overlay) */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-200 flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100 flex-shrink-0">
          <span className="text-xl font-bold text-blue-600">楽々日報</span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <DashboardHeader userName={session.user.name} />

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
