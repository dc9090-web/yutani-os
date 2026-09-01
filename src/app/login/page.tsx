import { LoginCard } from "./LoginCard.js";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginCard error={error ?? null} />;
}
