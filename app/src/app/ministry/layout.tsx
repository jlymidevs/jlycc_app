import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { memberNavForRole } from "@/lib/member-nav";
import type { Role } from "@/lib/authz";

export default async function MinistryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user.role ?? "MEMBER") as Role;

  return (
    <DashboardShell
      navItems={memberNavForRole(role)}
      portalLabel="Ministry Dashboard"
      brandHref="/me"
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
    >
      {children}
    </DashboardShell>
  );
}
