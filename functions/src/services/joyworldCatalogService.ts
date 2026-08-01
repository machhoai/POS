// =============================================================================
// JoyWorld Manager API — authoritative souvenir catalog and after-tax pricing
// =============================================================================

import { defineSecret } from "firebase-functions/params";

const DEFAULT_BASE_URL = "http://joyworld.jingjianx.vip";
const TOKEN_TTL_MS = 30 * 60 * 1000;
const PAGE_LIMIT = 200;
const MAX_PAGES = 100;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/** Secrets that must be bound to every Cloud Function invoking this service. */
export const joyworldUserSecret = defineSecret("JOYWORLD_USER");
export const joyworldPassSecret = defineSecret("JOYWORLD_PASS");

export interface JoyworldGiftCatalogItem {
  goodsId?: string;
  id?: string;
  giftNo?: string;
  giftName?: string;
  goodsName?: string;
  typeName?: string;
  price?: number | string;
  afterTaxPrice?: number | string;
  stockAmount?: number | string;
  isEnabled?: boolean;
  isOpenSales?: boolean;
}

function getBaseUrl(): string {
  return (process.env.JOYWORLD_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const userName = process.env.JOYWORLD_USER;
  const password = process.env.JOYWORLD_PASS;
  if (!userName || !password) {
    throw new Error(
      "Missing JOYWORLD_USER or JOYWORLD_PASS for souvenir catalog sync",
    );
  }

  const response = await fetch(`${getBaseUrl()}/basic/manager/login/account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, password }),
  });
  if (!response.ok) {
    throw new Error(`JoyWorld login failed: HTTP ${response.status}`);
  }

  const result = asRecord(await response.json());
  const nestedData = asRecord(result.data);
  const token = result.token || nestedData.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("JoyWorld login response did not include an access token");
  }

  cachedToken = token;
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return token;
}

async function fetchCatalogPage(
  page: number,
  token: string,
): Promise<Response> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_LIMIT),
    _t: String(Date.now()),
  });

  return fetch(`${getBaseUrl()}/gift/manager/base/list?${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Load the manager-side souvenir master catalog.
 *
 * Unlike the OpenAPI `gift_realtime_stock` action, this endpoint returns the
 * authoritative `goodsId`, `afterTaxPrice`, selling flags, and aggregate stock.
 */
export async function fetchSouvenirCatalog(): Promise<JoyworldGiftCatalogItem[]> {
  const items: JoyworldGiftCatalogItem[] = [];
  let token = await getAccessToken();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let response = await fetchCatalogPage(page, token);
    if (response.status === 401) {
      token = await getAccessToken(true);
      response = await fetchCatalogPage(page, token);
    }
    if (!response.ok) {
      throw new Error(
        `JoyWorld souvenir catalog failed: HTTP ${response.status}`,
      );
    }

    const result = asRecord(await response.json());
    const pageItems = Array.isArray(result.data)
      ? result.data as JoyworldGiftCatalogItem[]
      : [];
    items.push(...pageItems);

    const total = Number(result.totals ?? result.total ?? items.length);
    if (pageItems.length < PAGE_LIMIT || items.length >= total) {
      return items;
    }
  }

  throw new Error("JoyWorld souvenir catalog exceeded the pagination limit");
}
