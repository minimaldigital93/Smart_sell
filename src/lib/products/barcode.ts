/** EAN-13 checksum: weights 1,3,1,3… on the first 12 digits. */
export function ean13Checksum(twelve: string): number {
  if (!/^\d{12}$/.test(twelve)) throw new Error("Need 12 digits");
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(twelve[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Random valid EAN-13 starting with the supplied country/maker prefix (default 200 — in-store). */
export function generateEan13(prefix = "200"): string {
  if (!/^\d{1,12}$/.test(prefix)) throw new Error("Invalid prefix");
  let body = prefix;
  while (body.length < 12) {
    body += Math.floor(Math.random() * 10).toString();
  }
  body = body.slice(0, 12);
  return body + ean13Checksum(body).toString();
}

/** Lowercase, hyphen-separated, no diacritics. Truncates to 220 chars. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);
}
