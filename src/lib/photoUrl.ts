import { supabase } from '@/integrations/supabase/client';

/**
 * The 'photos' storage bucket is private. URLs were originally stored as public
 * URLs (`/storage/v1/object/public/photos/...`), which no longer work. To keep
 * photos visible in the public site we generate short-lived signed URLs on the
 * client. Storage RLS still controls who can sign URLs for which objects.
 */

const BUCKET = 'photos';
const PUBLIC_MARKER = `/object/public/${BUCKET}/`;
const SIGN_MARKER = `/object/sign/${BUCKET}/`;
const AUTH_MARKER = `/object/${BUCKET}/`;
// 7 days
const SIGN_EXPIRES_IN = 60 * 60 * 24 * 7;

const cache = new Map<string, { url: string; expiresAt: number }>();

function extractPath(url: string): string | null {
  for (const marker of [PUBLIC_MARKER, SIGN_MARKER, AUTH_MARKER]) {
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const rest = url.substring(idx + marker.length);
      // strip query string (e.g. existing ?token=...)
      const q = rest.indexOf('?');
      return q === -1 ? rest : rest.substring(0, q);
    }
  }
  return null;
}

export async function signPhotoUrl(
  url: string | null | undefined,
): Promise<string | undefined> {
  if (!url) return undefined;
  const path = extractPath(url);
  if (!path) return url;

  const cached = cache.get(path);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) return cached.url;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGN_EXPIRES_IN);
  if (error || !data?.signedUrl) return undefined;
  cache.set(path, {
    url: data.signedUrl,
    expiresAt: now + SIGN_EXPIRES_IN * 1000,
  });
  return data.signedUrl;
}

export async function signPhotoUrls(
  urls: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    urls.map(async (u) => {
      if (!u) return;
      const signed = await signPhotoUrl(u);
      if (signed) out.set(u, signed);
    }),
  );
  return out;
}

/** Backward-compatible no-op; prefer signPhotoUrl for new code. */
export function resolvePhotoUrl(url: string | null | undefined): string | undefined {
  return url ?? undefined;
}
