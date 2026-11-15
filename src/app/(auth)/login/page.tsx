import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeNextPath } from "@/features/auth/schemas";

export const metadata: Metadata = { title: "Sign in" };

// Known codes only, so the URL can't put arbitrary text on the page.
const NOTICES: Record<string, string> = {
  confirm_failed: "That confirmation link is invalid or has expired. Sign in, or sign up again for a new link.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  // The plain form is the static shell; the version that knows ?next and
  // ?error streams in at request time.
  return (
    <Suspense fallback={<LoginForm />}>
      <LoginWithParams searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginWithParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);
  return (
    <LoginForm
      next={nextPath === "/" ? undefined : nextPath}
      notice={typeof error === "string" ? NOTICES[error] : undefined}
    />
  );
}
