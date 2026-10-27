import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      <AppHeader role={session.role} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {children}
      </main>
      <BottomNav role={session.role} />
    </div>
  );
}
