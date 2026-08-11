import * as logger from "firebase-functions/logger";
import {
  fetchGoodsByCategory,
  fetchMemberAccounts,
  fetchMemberPackageDetail,
  precalculateOrder,
  type HKApiResponse,
} from "./hkApiService";
import { mapMemberAccounts, mapMemberPointPackage } from "./memberMapper";
import type {
  HKMemberPackageDetailDto,
  HKMemberPackageListItemDto,
  MemberAccountDefinition,
  MemberPointPackage,
} from "../types/member";
import { MemberRemoteApiError } from "../member/functions";

const PACKAGE_LOAD_CONCURRENCY = 3;

function nonNegativePackageValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function remoteReason<T>(response: HKApiResponse<T>, fallback: string): string {
  return response.msg?.trim() || response.desc?.trim() || fallback;
}

async function callRemote<T>(
  action: string,
  request: () => Promise<HKApiResponse<T>>,
): Promise<HKApiResponse<T>> {
  try {
    return await request();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "Không rõ nguyên nhân";
    throw new MemberRemoteApiError(
      action,
      null,
      `Không thể kết nối OpenAPI: ${reason}`,
    );
  }
}

function extractGoodsItems(data: Record<string, unknown> | null): HKMemberPackageListItemDto[] {
  if (!data) return [];
  const candidates = [data.goodsItems, data.items, data.list, data.data];
  return (candidates.find(Array.isArray) ?? []) as HKMemberPackageListItemDto[];
}

export function hasPlayableMemberPackageCredits(
  detail: HKMemberPackageDetailDto,
): boolean {
  const amount = nonNegativePackageValue(detail.amount, detail.Amount);
  const giveAmount = (detail.giveConfigs ?? []).reduce((total, config) => {
    const parsed = Number(config.giveAmount);
    return Number.isFinite(parsed) && parsed > 0 ? total + parsed : total;
  }, 0);
  return amount !== null && amount + giveAmount > 0;
}

async function loadPackageCatalogBase(): Promise<{
  listItems: HKMemberPackageListItemDto[];
  accounts: MemberAccountDefinition[];
}> {
  const [listResponse, accountResponse] = await Promise.all([
    callRemote("setmeal_getsellgoods", () => fetchGoodsByCategory(1)),
    callRemote("basic_account_list", () => fetchMemberAccounts()),
  ]);

  if (!listResponse.success) {
    throw new MemberRemoteApiError(
      "setmeal_getsellgoods",
      listResponse.code,
      remoteReason(listResponse, "OpenAPI không thể tải danh sách gói thành viên."),
    );
  }
  if (!accountResponse.success || !Array.isArray(accountResponse.data)) {
    throw new MemberRemoteApiError(
      "basic_account_list",
      accountResponse.code,
      remoteReason(accountResponse, "OpenAPI không thể tải cấu hình tài khoản điểm."),
    );
  }

  return {
    accounts: mapMemberAccounts(accountResponse.data),
    listItems: extractGoodsItems(listResponse.data),
  };
}

async function loadMappedPackage(
  uid: string,
  listItem: HKMemberPackageListItemDto,
  accounts: MemberAccountDefinition[],
): Promise<MemberPointPackage | null> {
  const goodsId = listItem.goodsId?.trim();
  if (!goodsId) return null;
  const detailResponse = await callRemote(
    "setmeal_passticket_details",
    () => fetchMemberPackageDetail(goodsId),
  );

  if (!detailResponse.success || !detailResponse.data) {
    throw new MemberRemoteApiError(
      "setmeal_passticket_details",
      detailResponse.code,
      remoteReason(detailResponse, `Không thể tải cấu hình gói ${goodsId}.`),
    );
  }
  if (!hasPlayableMemberPackageCredits(detailResponse.data)) {
    return null;
  }

  const calculationResponse = await callRemote(
    "order_precalculate",
    () => precalculateOrder({
      uid,
      goodsItems: [{ goodsId, quantity: "1" }],
    }),
  );
  if (!calculationResponse.success || !calculationResponse.data) {
    throw new MemberRemoteApiError(
      "order_precalculate",
      calculationResponse.code,
      remoteReason(calculationResponse, `Không thể tính giá gói ${goodsId}.`),
    );
  }

  return mapMemberPointPackage({
    listItem,
    detail: detailResponse.data,
    precalculation: calculationResponse.data,
    accounts,
  });
}

export async function loadRemoteMemberPackages(
  uid: string,
): Promise<MemberPointPackage[]> {
  const { listItems, accounts } = await loadPackageCatalogBase();
  const packages: MemberPointPackage[] = [];
  let firstFailure: unknown = null;

  for (let index = 0; index < listItems.length; index += PACKAGE_LOAD_CONCURRENCY) {
    const batch = listItems.slice(index, index + PACKAGE_LOAD_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((listItem) => loadMappedPackage(uid, listItem, accounts)),
    );

    results.forEach((result, resultIndex) => {
      if (result.status === "fulfilled") {
        if (result.value) packages.push(result.value);
        return;
      }
      firstFailure ??= result.reason;
      logger.warn("[Member packages] Bỏ qua gói không thể tải", {
        goodsId: batch[resultIndex]?.goodsId?.trim() || null,
        error: result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      });
    });
  }

  if (packages.length === 0 && firstFailure) throw firstFailure;

  return packages
    .sort((left, right) =>
      left.paymentAmountVnd - right.paymentAmountVnd ||
      left.totalPoints - right.totalPoints ||
      left.name.localeCompare(right.name, "vi"),
    );
}

export async function loadRemoteMemberPackage(
  uid: string,
  goodsId: string,
): Promise<MemberPointPackage> {
  const { listItems, accounts } = await loadPackageCatalogBase();
  const listItem = listItems.find((item) => item.goodsId?.trim() === goodsId);
  const selected = listItem
    ? await loadMappedPackage(uid, listItem, accounts)
    : null;
  if (!selected) {
    throw new MemberRemoteApiError(
      "setmeal_getsellgoods",
      null,
      "Gói thành viên không còn mở bán hoặc không cấp điểm sử dụng.",
    );
  }
  return selected;
}
