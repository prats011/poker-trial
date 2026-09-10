import { Badge, Card } from "@poker/ui";

type PageProps = {
  params: Promise<{ inviteToken: string }>;
};

export default async function GamePage({ params }: PageProps) {
  const { inviteToken } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6">
      <Card className="w-full space-y-4">
        <Badge>Table Route</Badge>
        <h1 className="text-2xl font-semibold">Game {inviteToken}</h1>
        <p className="text-sm text-[#8b949e]">Realtime table UI shell only. Seating and gameplay are out of scope for Chunk 1.</p>
      </Card>
    </main>
  );
}
