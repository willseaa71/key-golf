import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin Login — KEY Golf" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">KEY Golf</p>
          <h1 className="text-2xl font-bold">Admin</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
