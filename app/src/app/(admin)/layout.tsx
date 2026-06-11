// app/src/app/(admin)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { adminNavItems } from "@/lib/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <DashboardShell
      navItems={adminNavItems}
      portalLabel="Admin Portal"
      brandHref="/members"
      user={{
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}
