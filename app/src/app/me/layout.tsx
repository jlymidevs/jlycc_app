import MemberShell from "@/components/member-shell";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
