"use client";

import type { ReactNode } from "react";

/** Bouton submit qui demande confirmation (à placer dans un <form action={serverAction}>). */
export function ConfirmButton({
  message,
  className = "btn btn-danger btn-sm",
  children,
}: {
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
