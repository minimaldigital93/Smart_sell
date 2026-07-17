import { describe, expect, it } from "vitest";
import { buildKhqrPayload, crc16ccitt, tlv } from "@/lib/khqrpay/khqr-payload";
import {
  isValidCallbackFor,
  signCallback,
  signCheckRequest,
  signQrRequest,
  verifyCallbackSignature,
} from "@/lib/khqrpay/sign";
import {
  OPEN_STATUSES,
  canTransitionPayment,
  isOpen,
} from "@/lib/khqrpay/status";
import type { KhqrCredentials, PaymentStatus } from "@/lib/khqrpay/types";

const SECRET = "test-secret";
const CREDS: KhqrCredentials = {
  baseUrl: "https://khqr.cc",
  profileId: "123",
  secret: SECRET,
  currency: "USD",
};

describe("tlv / crc16 / buildKhqrPayload", () => {
  it("encodes TLV with zero-padded length", () => {
    expect(tlv("00", "01")).toBe("000201");
    expect(tlv("59", "SmartSell")).toBe("5909SmartSell");
  });

  it("computes CRC-16/CCITT-FALSE (known vectors)", () => {
    // Standard check value for "123456789" under CRC-16/CCITT-FALSE.
    expect(crc16ccitt("123456789")).toBe("29B1");
    expect(crc16ccitt("")).toBe("FFFF");
  });

  it("builds a well-formed dynamic KHQR payload", () => {
    const payload = buildKhqrPayload({
      transactionId: "ORD-12345678-20260716-123",
      amount: 12.5,
      bakongId: "merchant@aclb",
      merchantName: "Test Shop",
      currency: "USD",
    });
    expect(payload.startsWith("000201")).toBe(true); // format indicator
    expect(payload).toContain("0102" + "12"); // dynamic QR
    expect(payload).toContain("5303840"); // USD
    expect(payload).toContain("540512.50"); // amount, 2dp
    expect(payload).toContain("5802KH"); // country
    // CRC: last 4 chars verify over everything incl. the 6304 prefix.
    const body = payload.slice(0, -4);
    expect(body.endsWith("6304")).toBe(true);
    expect(payload.slice(-4)).toBe(crc16ccitt(body));
  });

  it("truncates merchant name to 25 chars and switches KHR", () => {
    const payload = buildKhqrPayload({
      transactionId: "T1",
      amount: 4100,
      merchantName: "An Extremely Long Merchant Name Ltd",
      currency: "KHR",
    });
    expect(payload).toContain("5303116"); // KHR
    expect(payload).not.toContain("Merchant Name Ltd"); // truncated at 25
  });
});

describe("signing", () => {
  it("signs the QR/checkout request as sha1(secret+tx+amount+url+remark)", () => {
    const hash = signQrRequest(
      {
        transaction_id: "T1",
        amount: "10.00",
        success_url: "https://shop.example/pay/x",
        remark: "Order payment T1",
      },
      SECRET,
    );
    expect(hash).toMatch(/^[a-f0-9]{40}$/);
    // Deterministic: same input, same hash.
    expect(
      signQrRequest(
        {
          transaction_id: "T1",
          amount: "10.00",
          success_url: "https://shop.example/pay/x",
          remark: "Order payment T1",
        },
        SECRET,
      ),
    ).toBe(hash);
    // Any field change changes the hash.
    expect(
      signQrRequest(
        {
          transaction_id: "T1",
          amount: "10.01",
          success_url: "https://shop.example/pay/x",
          remark: "Order payment T1",
        },
        SECRET,
      ),
    ).not.toBe(hash);
  });

  it("signs the check request as sha1(secret+tx)", () => {
    expect(signCheckRequest(SECRET, "T1")).toMatch(/^[a-f0-9]{40}$/);
    expect(signCheckRequest(SECRET, "T1")).not.toBe(
      signCheckRequest(SECRET, "T2"),
    );
  });

  it("verifies callback signatures constant-time, status uppercased", () => {
    const payload: Record<string, unknown> = {
      req_time: "1752650000",
      transaction_id: "T1",
      amount: "10.00",
      status: "success", // lowercase in payload; signature uses UPPER
    };
    payload.hash = signCallback(
      {
        req_time: "1752650000",
        transaction_id: "T1",
        amount: "10.00",
        status: "SUCCESS",
      },
      SECRET,
    );
    expect(verifyCallbackSignature(payload, SECRET)).toBe(true);
    expect(verifyCallbackSignature(payload, "wrong-secret")).toBe(false);
    expect(
      verifyCallbackSignature({ ...payload, amount: "999.00" }, SECRET),
    ).toBe(false);
    expect(verifyCallbackSignature({ ...payload, hash: undefined }, SECRET)).toBe(
      false,
    );
  });
});

describe("payment state machine", () => {
  it("mirrors the SQL transition table", () => {
    expect(canTransitionPayment("pending", "qr_generated")).toBe(true);
    expect(canTransitionPayment("qr_generated", "waiting_payment")).toBe(true);
    expect(canTransitionPayment("waiting_payment", "paid")).toBe(true);
    expect(canTransitionPayment("pending", "paid")).toBe(true);
    expect(canTransitionPayment("paid", "refunded")).toBe(true);
  });

  it("terminal states never move; paid never reopens", () => {
    const all: PaymentStatus[] = [
      "pending",
      "qr_generated",
      "waiting_payment",
      "paid",
      "failed",
      "expired",
      "cancelled",
      "refunded",
      "rejected",
    ];
    for (const to of all) {
      expect(canTransitionPayment("failed", to)).toBe(false);
      expect(canTransitionPayment("expired", to)).toBe(false);
      expect(canTransitionPayment("cancelled", to)).toBe(false);
      expect(canTransitionPayment("refunded", to)).toBe(false);
      expect(canTransitionPayment("rejected", to)).toBe(false);
    }
    expect(canTransitionPayment("paid", "waiting_payment")).toBe(false);
    expect(canTransitionPayment("paid", "paid")).toBe(false);
  });

  it("open set matches", () => {
    expect(OPEN_STATUSES).toEqual(["pending", "qr_generated", "waiting_payment"]);
    expect(isOpen("waiting_payment")).toBe(true);
    expect(isOpen("paid")).toBe(false);
  });
});

describe("isValidCallbackFor", () => {
  const row = { transactionId: "T1", amount: 10, currency: "USD" };
  const validPayload = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {
      req_time: "1752650000",
      transaction_id: "T1",
      amount: "10.00",
      status: "SUCCESS",
    };
    p.hash = signCallback(
      {
        req_time: "1752650000",
        transaction_id: "T1",
        amount: "10.00",
        status: "SUCCESS",
      },
      SECRET,
    );
    return p;
  };

  it("accepts a correctly signed SUCCESS for the exact row", () => {
    expect(isValidCallbackFor(validPayload(), CREDS, row)).toBe(true);
  });

  it("rejects non-SUCCESS status even when signed", () => {
    const p = validPayload();
    p.status = "FAILED";
    p.hash = signCallback(
      {
        req_time: "1752650000",
        transaction_id: "T1",
        amount: "10.00",
        status: "FAILED",
      },
      SECRET,
    );
    expect(isValidCallbackFor(p, CREDS, row)).toBe(false);
  });

  it("rejects amount/currency/transaction mismatches (valid signature)", () => {
    // A validly-signed $0.01 settlement must not finalize a $10 row.
    const cheap: Record<string, unknown> = {
      req_time: "1752650000",
      transaction_id: "T1",
      amount: "0.01",
      status: "SUCCESS",
    };
    cheap.hash = signCallback(
      {
        req_time: "1752650000",
        transaction_id: "T1",
        amount: "0.01",
        status: "SUCCESS",
      },
      SECRET,
    );
    expect(isValidCallbackFor(cheap, CREDS, row)).toBe(false);

    const otherTx = validPayload();
    otherTx.transaction_id = "T2";
    expect(isValidCallbackFor(otherTx, CREDS, row)).toBe(false);

    // Currency mismatch only triggers when the provider echoes a currency —
    // an absent field can't contradict (mirrors AMS amountCurrencyMatches).
    const khrPayload = validPayload();
    khrPayload.currency = "KHR";
    expect(isValidCallbackFor(khrPayload, CREDS, row)).toBe(false);
    expect(isValidCallbackFor(validPayload(), CREDS, row)).toBe(true);
  });
});
