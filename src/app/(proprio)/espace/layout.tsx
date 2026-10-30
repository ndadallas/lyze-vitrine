import { requireOwner } from "@/lib/auth";

export default async function EspaceLayout({ children }: LayoutProps<"/espace">) {
  await requireOwner();
  return children;
}
