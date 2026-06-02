/**
 * Telegram notification helper.
 *
 * Disabled when TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing — used for
 * dev environments and graceful degradation. Failures NEVER throw to callers;
 * the goal is "best-effort ping the shop owner", not transactional delivery.
 */

const TG_API = "https://api.telegram.org";

function escapeMarkdownV2(text: string): string {
  // https://core.telegram.org/bots/api#markdownv2-style
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, (m) => `\\${m}`);
}

export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
      // Telegram is slow occasionally; cap so we don't stall a server action.
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[telegram] non-OK", res.status, body.slice(0, 200));
    }
  } catch (err) {
    console.error("[telegram] send failed", err);
  }
}

export type NewOrderPayload = {
  orderId: string;
  customerName: string;
  phone: string;
  total: number;
  paymentMethod: string;
  itemCount: number;
};

export async function notifyNewOrder(p: NewOrderPayload): Promise<void> {
  const lines = [
    `*🛍 New order*`,
    `Order: \`${escapeMarkdownV2(p.orderId.slice(0, 8))}\``,
    `Customer: ${escapeMarkdownV2(p.customerName)}`,
    `Phone: ${escapeMarkdownV2(p.phone)}`,
    `Items: ${p.itemCount}`,
    `Total: $${escapeMarkdownV2(p.total.toFixed(2))} \\(${escapeMarkdownV2(p.paymentMethod)}\\)`,
  ];
  await sendTelegram(lines.join("\n"));
}

export type LowStockPayload = {
  productName: string;
  productId: string;
  currentStock: number;
  minimumStock: number;
};

export async function notifyLowStock(p: LowStockPayload): Promise<void> {
  const lines = [
    `*⚠️ Low stock*`,
    `${escapeMarkdownV2(p.productName)}`,
    `On hand: ${p.currentStock} \\(min: ${p.minimumStock}\\)`,
  ];
  await sendTelegram(lines.join("\n"));
}
