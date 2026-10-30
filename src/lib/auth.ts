import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export function homeFor(role: "ADMIN" | "OWNER") {
  return role === "ADMIN" ? "/admin" : "/espace";
}

export async function requireOwner() {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  if (user.role !== "OWNER") redirect(homeFor(user.role));
  return user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  if (user.role !== "ADMIN") redirect(homeFor(user.role));
  return user;
}
