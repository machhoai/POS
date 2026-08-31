export function buildProductGroupKey(value: {
  category?: unknown;
  typeId?: unknown;
  typeName?: unknown;
  subCategory?: unknown;
}): string {
  const category = Number.isFinite(Number(value.category))
    ? Number(value.category)
    : 0;
  const normalize = (candidate: unknown) =>
    typeof candidate === "string"
      ? candidate.trim().normalize("NFKC").toLocaleLowerCase("vi").replace(/\s+/g, " ")
      : "";
  const typeId = normalize(value.typeId);
  if (typeId) return `category:${category}:id:${typeId}`;
  const typeName = normalize(value.typeName) || normalize(value.subCategory);
  return typeName
    ? `category:${category}:name:${typeName}`
    : `category:${category}:ungrouped`;
}

