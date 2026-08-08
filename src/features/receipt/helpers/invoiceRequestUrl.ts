import type { PosOrder } from "@/lib/types/order";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function buildInvoiceRequestUrl(
  order: Pick<PosOrder, "invoiceRequestToken">,
  baseUrl = process.env.NEXT_PUBLIC_INVOICE_REQUEST_BASE_URL,
): string | null {
  if (!baseUrl || !TOKEN_PATTERN.test(order.invoiceRequestToken ?? "")) {
    return null;
  }

  try {
    const normalizedBase = new URL(baseUrl);
    normalizedBase.pathname = `${normalizedBase.pathname.replace(/\/$/, "")}/${order.invoiceRequestToken}`;
    normalizedBase.search = "";
    normalizedBase.hash = "";
    return normalizedBase.toString();
  } catch {
    return null;
  }
}
