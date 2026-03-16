export const CANONICAL_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://stuller.vercel.app';

export function buildAppUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${CANONICAL_APP_URL}${normalizedPath}`;
}
