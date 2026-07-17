/**
 * EMVCo/Bakong KHQR string builder, ported from AMS buildKhqrPayload/crc16.
 * Pure module — used for demo-mode QRs (rendered locally with `qrcode`).
 * With a real Bakong account id the payload is directly scannable + payable.
 */

/** TLV: id + zero-padded length (2 digits) + value. */
export function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — the KHQR checksum. */
export function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).padStart(4, "0").toUpperCase();
}

export function buildKhqrPayload(opts: {
  transactionId: string;
  amount: number;
  bakongId?: string;
  merchantName?: string;
  currency?: "USD" | "KHR";
}): string {
  const bakongId = opts.bakongId || "demo@aclb";
  const merchant = (opts.merchantName || "SmartSell").slice(0, 25);
  const currency = (opts.currency ?? "USD") === "KHR" ? "116" : "840";

  // Tag 29: merchant account information (Bakong) — sub-tag 00 = account ID.
  const merchantAccount = tlv("00", bakongId);

  let payload =
    tlv("00", "01") +                                  // payload format indicator
    tlv("01", "12") +                                  // dynamic QR
    tlv("29", merchantAccount) +                       // Bakong account info
    tlv("52", "5999") +                                // merchant category code
    tlv("53", currency) +                              // transaction currency
    tlv("54", opts.amount.toFixed(2)) +                // amount
    tlv("58", "KH") +                                  // country code
    tlv("59", merchant) +                              // merchant name
    tlv("60", "Phnom Penh") +                          // merchant city
    tlv("99", tlv("00", opts.transactionId.slice(0, 25))); // bill number

  // Tag 63: CRC over everything including the "6304" prefix.
  payload += "6304";
  return payload + crc16ccitt(payload);
}
