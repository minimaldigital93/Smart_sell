// Minimal ambient types for the untyped `bakong-khqr` SDK (CommonJS, no types).
// Only the surface we use: generating an individual KHQR string + its md5.
declare module "bakong-khqr" {
  export interface KHQROptional {
    currency?: number;
    amount?: number;
    billNumber?: string;
    storeLabel?: string;
    terminalLabel?: string;
    mobileNumber?: string;
    expirationTimestamp?: number;
  }

  export class IndividualInfo {
    constructor(
      bakongAccountID: string,
      merchantName: string,
      merchantCity: string,
      optional?: KHQROptional,
    );
  }

  export class MerchantInfo {
    constructor(
      bakongAccountID: string,
      merchantName: string,
      merchantCity: string,
      merchantID: string,
      acquiringBank: string,
      optional?: KHQROptional,
    );
  }

  export interface KHQRResult {
    qr: string;
    md5: string;
  }

  export interface KHQRResponse {
    data: KHQRResult | null;
    status?: { code: number; errorCode?: number; message?: string } | null;
  }

  export class BakongKHQR {
    constructor();
    generateIndividual(info: IndividualInfo): KHQRResponse;
    generateMerchant(info: MerchantInfo): KHQRResponse;
  }

  export const khqrData: {
    currency: { usd: number; khr: number };
    [key: string]: unknown;
  };
}
