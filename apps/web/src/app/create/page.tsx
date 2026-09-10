import { Card, Input, Button } from "@poker/ui";

export default function CreatePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6">
      <Card className="w-full space-y-4">
        <h1 className="text-2xl font-semibold">Create Table</h1>
        <p className="text-sm text-[#8b949e]">Placeholder route only. Submission logic is out of scope for Chunk 1.</p>
        <Input placeholder="Table name (disabled placeholder)" disabled />
        <Button disabled>Create (coming soon)</Button>
      </Card>
    </main>
  );
}
