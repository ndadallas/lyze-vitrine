"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/app/(gestion)/admin/actions";
import { CredentialsCard } from "@/components/CredentialsCard";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Formulaire branché sur une server action : affiche erreur / succès / identifiants générés.
 * Les champs ne sont vidés qu'en cas de succès (React les viderait aussi après une erreur).
 */
export function ActionForm({
  action,
  submitLabel,
  submitClassName = "btn btn-primary",
  className,
  confirmMessage,
  children,
}: {
  action: Action;
  submitLabel: string;
  submitClassName?: string;
  className?: string;
  confirmMessage?: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.done) formRef.current?.reset();
  }, [state?.done]);

  return (
    <div className="stack">
      <form
        ref={formRef}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          const formData = new FormData(e.currentTarget);
          startTransition(() => formAction(formData));
        }}
      >
        {children}
        <button type="submit" className={submitClassName} disabled={pending}>
          {pending ? "Patientez…" : submitLabel}
        </button>
      </form>

      {state?.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="alert alert-success" role="status">
          {state.message}
        </p>
      )}
      {state?.credentials && <CredentialsCard key={state.done} credentials={state.credentials} />}
    </div>
  );
}
