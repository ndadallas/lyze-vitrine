import { NavLink } from "@/components/NavLink";
import { Sidebar } from "@/components/Sidebar";
import { IconUsers } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="shell">
      <Sidebar home="/admin">
        <NavLink href="/admin" icon={<IconUsers />}>
          Clients
        </NavLink>
      </Sidebar>
      <main className="content">{children}</main>
    </div>
  );
}
