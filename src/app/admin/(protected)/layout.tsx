import Link from "next/link";
import { checkAdminAuth } from "@/lib/admin-auth";
import { logout } from "@/app/admin/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await checkAdminAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-[#006747] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold tracking-wide">KEY Golf Admin</span>
          <Link href="/admin" className="text-sm text-white/80 hover:text-white">Rounds</Link>
          <Link href="/admin/players" className="text-sm text-white/80 hover:text-white">Players</Link>
          <Link href="/admin/seasons" className="text-sm text-white/80 hover:text-white">Seasons</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-white/70 hover:text-white">← App</Link>
          <form action={logout}>
            <button type="submit" className="text-sm text-white/80 hover:text-white">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
