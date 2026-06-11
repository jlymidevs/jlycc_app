import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { adminNavForRole } from "@/lib/admin-nav";
import type { Role } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user?.role ?? "MEMBER") as Role;

  return (
    <DashboardShell
      navItems={adminNavForRole(role)}
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
