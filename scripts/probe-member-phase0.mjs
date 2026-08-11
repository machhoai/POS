import { createHash } from "node:crypto";
import { loadEnvFile } from "node:process";

loadEnvFile(".env.local");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  }
  return value;
}

const appId = requireEnv("HK_API_APP_ID");
const apiKey = requireEnv("HK_API_KEY");
const configuredUrl = requireEnv("HK_API_BASE_URL");

function resolveEndpoint(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith("/openapi/action")) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/openapi/action`;
  }
  return url.toString();
}

const endpoint = resolveEndpoint(configuredUrl);

function createEnvelope(action, version, data) {
  const timestamp = String(Date.now());
  const body = JSON.stringify(data);
  const sign = createHash("md5")
    .update(`${appId}${action}${version}${timestamp}${body}${apiKey}`, "utf8")
    .digest("hex")
    .toUpperCase();

  return { appId, action, version, timestamp, sign, body };
}

async function callOpenApi(action, version, data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createEnvelope(action, version, data)),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        `${action} trả về HTTP ${response.status} nhưng không phải JSON: ${text.slice(0, 300)}`,
      );
    }

    return { httpStatus: response.status, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function extractArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of ["goodsItems", "items", "list", "data", "rows"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function relevantPackageFields(item) {
  const relevantPattern =
    /(id|name|category|price|money|vnd|bonus|give|point|coin|integral|amount|value|gift|stored|tax)/i;

  return Object.fromEntries(
    Object.entries(item).filter(
      ([key, value]) =>
        (relevantPattern.test(key) || key.toLowerCase() === "remark") &&
        (value === null || ["string", "number", "boolean"].includes(typeof value)),
    ),
  );
}

function redactMemberBalances(member) {
  if (!member || typeof member !== "object") return null;

  const balancePattern =
    /(nativecoin|givecoin|coinbal|integral|point|stored|money|extend0[123]|balance)/i;
  const balances = Object.fromEntries(
    Object.entries(member).filter(
      ([key, value]) => balancePattern.test(key) && typeof value === "number",
    ),
  );

  return {
    availableFields: Object.keys(member).sort(),
    balanceBuckets: balances,
  };
}

async function probePackages() {
  const categories = [1, 2, 6];
  const output = [];

  for (const category of categories) {
    const result = await callOpenApi("setmeal_getsellgoods", "11.7.1", {
      Category: String(category),
    });
    const items = extractArray(result.payload?.data);
    const firstItem = items[0] && typeof items[0] === "object" ? items[0] : null;

    output.push({
      category,
      httpStatus: result.httpStatus,
      success: result.payload?.success === true,
      code: result.payload?.code,
      message: result.payload?.msg || result.payload?.desc || "",
      itemCount: items.length,
      goodsIds: items
        .map((item) => item?.goodsId)
        .filter((goodsId) => typeof goodsId === "string"),
      allFieldNames: firstItem ? Object.keys(firstItem).sort() : [],
      samples: items.slice(0, 3).map(relevantPackageFields),
    });
  }

  return output;
}

async function probePackageCalculation(goodsId) {
  if (!goodsId) return null;

  const result = await callOpenApi("order_precalculate", "11.7.1", {
    Uid: "",
    GoodsItems: [{ GoodsId: goodsId, Quantity: "1" }],
  });
  const goods = extractArray(result.payload?.data?.goodsList);
  const firstItem = goods[0] && typeof goods[0] === "object" ? goods[0] : null;

  return {
    httpStatus: result.httpStatus,
    success: result.payload?.success === true,
    code: result.payload?.code,
    message: result.payload?.msg || result.payload?.desc || "",
    totals: result.payload?.data
      ? Object.fromEntries(
          Object.entries(result.payload.data).filter(
            ([key, value]) =>
              /(total|money|amount|discount|qty)/i.test(key) &&
              typeof value === "number",
          ),
        )
      : null,
    allGoodsFieldNames: firstItem ? Object.keys(firstItem).sort() : [],
    goodsSample: firstItem ? relevantPackageFields(firstItem) : null,
  };
}

async function probePackageDetails(goodsId) {
  if (!goodsId) return null;

  const result = await callOpenApi("setmeal_passticket_details", "11.7.1", {
    setmealId: goodsId,
  });
  const data = result.payload?.data;

  return {
    httpStatus: result.httpStatus,
    success: result.payload?.success === true,
    code: result.payload?.code,
    message: result.payload?.msg || result.payload?.desc || "",
    allFieldNames: data && typeof data === "object" ? Object.keys(data).sort() : [],
    relevantFields:
      data && typeof data === "object"
        ? {
            ...relevantPackageFields(data),
            giveConfigs: Array.isArray(data.giveConfigs) ? data.giveConfigs : [],
            exchangeSetts: Array.isArray(data.exchangeSetts) ? data.exchangeSetts : [],
          }
        : null,
  };
}

async function probeAllPackageDetails(goodsIds) {
  const details = [];
  const batchSize = 3;

  for (let index = 0; index < goodsIds.length; index += batchSize) {
    const batch = goodsIds.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(probePackageDetails));
    details.push(...batchResults);
  }

  return details.map((detail) => ({
    success: detail?.success === true,
    code: detail?.code,
    message: detail?.message || "",
    fields: detail?.relevantFields
      ? {
          setMealId: detail.relevantFields.setMealId,
          setMealName: detail.relevantFields.setMealName,
          category: detail.relevantFields.category,
          price: detail.relevantFields.price,
          afterTaxPrice: detail.relevantFields.afterTaxPrice,
          amount: detail.relevantFields.amount,
          nativecoin1: detail.relevantFields.nativecoin1,
          givecoin1: detail.relevantFields.givecoin1,
          coinbal2: detail.relevantFields.coinbal2,
          integral: detail.relevantFields.integral,
          giveConfigs: detail.relevantFields.giveConfigs,
          exchangeSetts: detail.relevantFields.exchangeSetts,
        }
      : null,
  }));
}

async function probeAccountList() {
  const result = await callOpenApi("basic_account_list", "11.7.1", { scene: 2 });
  const accounts = extractArray(result.payload?.data);

  return {
    httpStatus: result.httpStatus,
    success: result.payload?.success === true,
    code: result.payload?.code,
    message: result.payload?.msg || result.payload?.desc || "",
    accountCount: accounts.length,
    accounts: accounts.map((account) =>
      Object.fromEntries(
        Object.entries(account).filter(([, value]) =>
          value === null || ["string", "number", "boolean"].includes(typeof value),
        ),
      ),
    ),
  };
}

async function probeBalanceBuckets() {
  const result = await callOpenApi("member_list", "10.11.8", {
    phone: "",
    page: 1,
    limit: 20,
    sortField: "CreateTime",
    sortType: "desc",
  });
  const members = extractArray(result.payload?.data);
  const lookupMember = members.find(
    (member) =>
      member &&
      typeof member.phone === "string" &&
      /^\d{9,15}$/.test(member.phone) &&
      Number.isInteger(Number(member.shopId)),
  );
  let phoneLookup = null;

  if (lookupMember) {
    const phoneResult = await callOpenApi("member_getmember_phone", "10.11.8", {
      shopId: Number(lookupMember.shopId),
      phone: lookupMember.phone,
    });
    const items = extractArray(phoneResult.payload?.data?.items);
    const matchingShop = items.find(
      (item) => Number(item?.shopId) === Number(lookupMember.shopId),
    );

    phoneLookup = {
      httpStatus: phoneResult.httpStatus,
      success: phoneResult.payload?.success === true,
      code: phoneResult.payload?.code,
      message: phoneResult.payload?.msg || phoneResult.payload?.desc || "",
      matchedCurrentShop: Boolean(matchingShop),
      storedValues: Array.isArray(matchingShop?.storedValues)
        ? matchingShop.storedValues
        : [],
      memberListBalanceBuckets: redactMemberBalances(lookupMember)?.balanceBuckets,
    };
  }

  return {
    httpStatus: result.httpStatus,
    success: result.payload?.success === true,
    code: result.payload?.code,
    message: result.payload?.msg || result.payload?.desc || "",
    returnedMemberCount: members.length,
    anonymousSample: redactMemberBalances(lookupMember || members[0]),
    phoneLookup,
    aggregateBuckets: redactMemberBalances(result.payload?.footData),
  };
}

async function main() {
  const [packages, balances, accounts] = await Promise.all([
    probePackages(),
    probeBalanceBuckets(),
    probeAccountList(),
  ]);
  const firstPackageId = packages.find((entry) => entry.category === 1)?.samples[0]?.goodsId;
  const categoryOneIds = packages.find((entry) => entry.category === 1)?.goodsIds || [];
  const [precalculation, packageDetails, allPackageDetails] = await Promise.all([
    probePackageCalculation(firstPackageId),
    probePackageDetails(firstPackageId),
    probeAllPackageDetails(categoryOneIds),
  ]);

  console.log(
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        readOnlyActions: [
          "setmeal_getsellgoods",
          "member_list",
          "member_getmember_phone",
          "order_precalculate",
          "setmeal_passticket_details",
          "basic_account_list",
        ],
        packages,
        precalculation,
        packageDetails,
        allPackageDetails,
        accounts,
        balances,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[phase0-probe] ${message}`);
  process.exitCode = 1;
});
