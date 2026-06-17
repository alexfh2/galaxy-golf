/**
 * The 'photos' storage bucket is private. Existing URLs were generated via
 * `getPublicUrl()` and stored as `/storage/v1/object/public/photos/...`,
 * which only works on public buckets. Rewrite to the authenticated endpoint
 * `/storage/v1/object/photos/...`, which is gated by RLS on storage.objects.
 *
 * RLS allows anonymous reads for player photos and for photos linked to
 * published rounds, so the rewritten URLs work for the public site while
 * draft round photos stay protected.
 */
export function resolvePhotoUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace('/storage/v1/object/public/photos/', '/storage/v1/object/photos/');
}
