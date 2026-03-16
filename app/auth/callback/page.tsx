import AuthCallbackClient from './AuthCallbackClient';

type CallbackPageProps = {
  searchParams: Promise<{
    code?: string;
    error?: string;
    error_description?: string;
  }>;
};

export default async function AuthCallbackPage({ searchParams }: CallbackPageProps) {
  const params = await searchParams;

  return (
    <AuthCallbackClient
      code={params.code ?? null}
      errorMessage={params.error_description ?? params.error ?? null}
    />
  );
}
