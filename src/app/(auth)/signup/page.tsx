import type { Metadata } from "next";
import { SignupForm } from "@/features/auth/components/signup-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Create account") };
}

export default function SignupPage() {
  return <SignupForm />;
}
