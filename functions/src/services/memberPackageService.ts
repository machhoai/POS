import {
  fetchGoodsByCategory,
  fetchMemberAccounts,
  fetchMemberPackageDetail,
  precalculateOrder,
  type HKApiResponse,
} from "./hkApiService";
import { mapMemberAccounts, mapMemberPointPackage } from "./memberMapper";
import type {
  HKMemberPackageListItemDto,
  MemberAccountDefinition,
  MemberPointPackage,
} from "../types/member";
import { MemberRemoteApiError } from "../member/functions";

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
  const [detailResponse, calculationResponse] = await Promise.all([
    callRemote(
      "setmeal_passticket_details",
      () => fetchMemberPackageDetail(goodsId),
    ),
    callRemote("order_precalculate", () => precalculateOrder({
      uid,
      goodsItems: [{ goodsId, quantity: "1" }],
    })),
  ]);

  if (!detailResponse.success || !detailResponse.data) {
    throw new MemberRemoteApiError(
      "setmeal_passticket_details",
      detailResponse.code,
      remoteReason(detailResponse, `Không thể tải cấu hình gói ${goodsId}.`),
    );
  }
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
  const packages = await Promise.all(
    listItems.map((listItem) => loadMappedPackage(uid, listItem, accounts)),
  );

  return packages
    .filter((item): item is MemberPointPackage => item !== null)
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
