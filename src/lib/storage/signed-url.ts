import { createClient } from "@/lib/supabase/server";

/**
 * Resolve a stored storage reference (either a legacy public URL or a bare
 * object path) into a short-lived signed URL the current caller is allowed to
 * read. Returns null when there's nothing to show or the caller lacks access.
 *
 * Buckets holding sensitive media (payment receipts, audit photos) are private,
 * so the public URL persisted on the row no longer resolves on its own — every
 * display site must mint a signed URL scoped to the viewer's session/RLS.
 */
export async function getSignedStorageUrl(
  bucket: string,
  stored: string | null | undefined,
  expiresInSec = 600,
): Promise<string | null> {
  if (!stored) return null;

  const path = extractObjectPath(bucket, stored);
  if (!path) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);

  if (error || !data?.signedUrl) {
    // Most often this is an RLS denial (caller can't read the object) — treat
    // it as "no image" rather than surfacing an error.
    return null;
  }
  return data.signedUrl;
}

/** Pull the object key out of a public/signed URL, or accept a bare path. */
function extractObjectPath(bucket: string, stored: string): string | null {
  const pub = `/object/public/${bucket}/`;
  const sign = `/object/sign/${bucket}/`;

  const pubIdx = stored.indexOf(pub);
  if (pubIdx >= 0) return stripQuery(stored.slice(pubIdx + pub.length));

  const signIdx = stored.indexOf(sign);
  if (signIdx >= 0) return stripQuery(stored.slice(signIdx + sign.length));

  // Already a bare path (possibly with a leading bucket/ prefix or slash).
  const bare = stored.replace(/^\/+/, "");
  return bare.startsWith(`${bucket}/`) ? bare.slice(bucket.length + 1) : bare;
}

function stripQuery(s: string): string {
  const q = s.indexOf("?");
  return q >= 0 ? s.slice(0, q) : s;
}
