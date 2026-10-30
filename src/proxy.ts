import { NextResponse, type NextRequest } from "next/server";

// Contrôle rapide : pas de cookie = retour à la connexion.
// La vraie vérification (session valide, rôle) est faite côté serveur dans chaque layout/page.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("lyze_session")) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/espace/:path*", "/admin/:path*"],
};
