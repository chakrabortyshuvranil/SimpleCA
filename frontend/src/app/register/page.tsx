import RegisterForm from "@/components/RegisterForm";
import { getGoogleLoginUrl } from "@/lib/api";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-16">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <RegisterForm next={next ?? "/"} googleLoginUrl={getGoogleLoginUrl()} />
    </div>
  );
}
