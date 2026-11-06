import { Lobby } from "../../../components/Lobby";

type PageProps = {
  params: Promise<{ inviteToken: string }>;
};

export default async function GamePage({ params }: PageProps) {
  const { inviteToken } = await params;
  return <Lobby inviteToken={inviteToken} />;
}
