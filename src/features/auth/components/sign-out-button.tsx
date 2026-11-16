import { Button } from "@/components/ui/button";
import { Tr } from "@/lib/i18n/client";
import { signOut } from "../actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline" size="sm">
        <Tr k="Sign out" />
      </Button>
    </form>
  );
}
