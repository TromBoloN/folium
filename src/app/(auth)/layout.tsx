import { Ambient } from "@/components/motion/ambient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <Ambient />
      <Card className="w-full max-w-sm shadow-raised">
        <CardHeader>
          <CardTitle className="font-display font-medium text-3xl">Folium</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
