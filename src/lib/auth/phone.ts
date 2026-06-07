/**
 * Phone-based auth helpers.
 *
 * We authenticate users by phone number + password. Supabase password auth is
 * built around emails, so we map each phone number to a stable synthetic email
 * (`<normalized>@phone.local`). As long as sign-up and sign-in normalize the
 * number identically, the synthetic email matches and login works — no SMS
 * provider required.
 */

/**
 * Domain used for synthetic phone-login emails. Mail is never delivered here,
 * but it MUST use a real TLD — GoTrue rejects reserved TLDs like `.local` with
 * "email_address_invalid". `.app` passes validation.
 */
export const PHONE_EMAIL_DOMAIN = "phone.csms.app";

/**
 * Normalize a Cambodian phone number to a canonical digits-only local form so
 * that "012 345 678", "+855 12 345 678" and "85512345678" all resolve to the
 * same key.
 */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("855")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** Map a phone number to the synthetic email used for Supabase auth. */
export function phoneToEmail(input: string): string {
  return `${normalizePhone(input)}@${PHONE_EMAIL_DOMAIN}`;
}
