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
interface CachedCashierToken {
  token: string;
  expiresAt: number;
}

const cachedCashierTokens = new Map<number, CachedCashierToken>();
const cashierTokenRequests = new Map<number, Promise<string>>();

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
  foreColor?: string | null;
  backColor?: string | null;
  price?: number | string;
  afterTaxPrice?: number | string;
  stockAmount?: number | string;
  isEnabled?: boolean;
  isOpenSales?: boolean;
}

export interface JoyworldMemberPointPackageItem {
  setMealId?: string;
  setMealName?: string;
  typeId?: string;
  typeName?: string;
  category?: number | string;
  foreColor?: string | null;
  backColor?: string | null;
  price?: number | string;
  afterTaxPrice?: number | string;
  isEnabled?: boolean;
  isOpenSales?: boolean;
}

export function resolveJoyworldBaseUrl(
  joyworldBaseUrl?: string,
  hkApiBaseUrl?: string,
): string {
  if (joyworldBaseUrl?.trim()) {
    return joyworldBaseUrl.trim().replace(/\/+$/, "");
  }

  if (hkApiBaseUrl?.trim()) {
    // HK_API_BASE_URL points to `/openapi/action`; manager endpoints live at
    // the same origin, not below the OpenAPI action path.
    return new URL(hkApiBaseUrl.trim()).origin;
  }

  return DEFAULT_BASE_URL;
}

export function getJoyworldBaseUrl(): string {
  return resolveJoyworldBaseUrl(
    process.env.JOYWORLD_BASE_URL,
    process.env.HK_API_BASE_URL,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

export async function getJoyworldManagerAccessToken(
  forceRefresh = false,
): Promise<string> {
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

  const response = await fetch(
    `${getJoyworldBaseUrl()}/basic/manager/login/account`,
    {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, password }),
    },
  );
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

async function loadCashierWorkPlaceIds(
  shopId: number,
): Promise<string[]> {
  const request = async (token: string) => fetch(
    `${getJoyworldBaseUrl()}/device/manager/workplace/getsimpleworkplace?category=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "JJ-SHOPID": String(shopId),
      },
    },
  );
  let managerToken = await getJoyworldManagerAccessToken();
  let response = await request(managerToken);
  if (response.status === 401) {
    managerToken = await getJoyworldManagerAccessToken(true);
    response = await request(managerToken);
  }
  if (!response.ok) {
    throw new Error(
      `JoyWorld workplace lookup failed: HTTP ${response.status}`,
    );
  }

  const result = asRecord(await response.json());
  if (result.success !== true || !Array.isArray(result.data)) {
    throw new Error("JoyWorld did not return cashier workplaces");
  }
  return [...new Set(result.data
    .map((entry) => asRecord(entry).workPlaceId)
    .filter((value): value is string => (
      typeof value === "string" && value.length > 0
    )))];
}

async function loginCashier(shopId: number): Promise<string> {
  const userName = process.env.JOYWORLD_USER;
  const password = process.env.JOYWORLD_PASS;
  if (!userName || !password) {
    throw new Error(
      "Missing JOYWORLD_USER or JOYWORLD_PASS for cashier login",
    );
  }

  const workPlaceIds = await loadCashierWorkPlaceIds(shopId);
  if (workPlaceIds.length === 0) {
    throw new Error("JoyWorld account has no cashier workplace for this shop");
  }

  for (const workPlaceId of workPlaceIds) {
    const response = await fetch(
      `${getJoyworldBaseUrl()}/basic/cashier/login/account`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "JJ-SHOPID": String(shopId),
        },
        body: JSON.stringify({ workPlaceId, userName, password }),
      },
    );
    if (!response.ok) continue;

    const result = asRecord(await response.json());
    const data = asRecord(result.data);
    const token = data.token;
    if (result.success !== true || typeof token !== "string" || !token) {
      continue;
    }
    if (String(data.shopId) !== String(shopId)) continue;

    const expiresInMinutes = Number(data.expiresIn);
    const ttlMs = Number.isFinite(expiresInMinutes) && expiresInMinutes > 5
      ? (expiresInMinutes - 5) * 60 * 1000
      : TOKEN_TTL_MS;
    cachedCashierTokens.set(shopId, {
      token,
      expiresAt: Date.now() + ttlMs,
    });
    return token;
  }

  throw new Error(
    "JoyWorld account could not log in to any cashier workplace for this shop",
  );
}

/** Get a terminal-scoped cashier token using only the configured account. */
export async function getJoyworldCashierAccessToken(
  shopId: number,
  forceRefresh = false,
): Promise<string> {
  if (forceRefresh) {
    cachedCashierTokens.delete(shopId);
  } else {
    const cached = cachedCashierTokens.get(shopId);
    if (cached && Date.now() < cached.expiresAt) return cached.token;
  }

  const pending = cashierTokenRequests.get(shopId);
  if (pending && !forceRefresh) return pending;

  const request = loginCashier(shopId);
  cashierTokenRequests.set(shopId, request);
  try {
    return await request;
  } finally {
    if (cashierTokenRequests.get(shopId) === request) {
      cashierTokenRequests.delete(shopId);
    }
  }
}

/** @internal Test-only cache reset. */
export function resetJoyworldAccessTokenCachesForTest(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
  cachedCashierTokens.clear();
  cashierTokenRequests.clear();
}

async function fetchManagerCatalogPage(
  path: string,
  parameters: Record<string, string>,
  page: number,
  token: string,
): Promise<Response> {
  const query = new URLSearchParams({
    ...parameters,
    page: String(page),
    limit: String(PAGE_LIMIT),
    _t: String(Date.now()),
  });

  return fetch(`${getJoyworldBaseUrl()}${path}?${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

async function fetchManagerCatalog<T>(
  path: string,
  parameters: Record<string, string> = {},
): Promise<T[]> {
  const items: T[] = [];
  let token = await getJoyworldManagerAccessToken();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let response = await fetchManagerCatalogPage(
      path,
      parameters,
      page,
      token,
    );
    if (response.status === 401) {
      token = await getJoyworldManagerAccessToken(true);
      response = await fetchManagerCatalogPage(
        path,
        parameters,
        page,
        token,
      );
    }
    if (!response.ok) {
      throw new Error(
        `JoyWorld manager catalog ${path} failed: HTTP ${response.status}`,
      );
    }

    const result = asRecord(await response.json());
    const pageItems = Array.isArray(result.data)
      ? result.data as T[]
      : [];
    items.push(...pageItems);

    const total = Number(result.totals ?? result.total ?? items.length);
    if (pageItems.length < PAGE_LIMIT || items.length >= total) {
      return items;
    }
  }

  throw new Error(`JoyWorld manager catalog ${path} exceeded pagination limit`);
}

/** Load all member point packages, including disabled and closed products. */
export function fetchMemberPointPackageCatalog(): Promise<
  JoyworldMemberPointPackageItem[]
> {
  return fetchManagerCatalog<JoyworldMemberPointPackageItem>(
    "/setmeal/manager/coin/list",
    { category: "1" },
  );
}

/**
 * Load the manager-side souvenir master catalog.
 *
 * Unlike the OpenAPI `gift_realtime_stock` action, this endpoint returns the
 * authoritative `goodsId`, `afterTaxPrice`, selling flags, and aggregate stock.
 */
export async function fetchSouvenirCatalog(): Promise<JoyworldGiftCatalogItem[]> {
  return fetchManagerCatalog<JoyworldGiftCatalogItem>(
    "/gift/manager/base/list",
  );
}
