import type { MemberRegistrationGender } from "@/lib/types/member";
import type {
  ImportedMemberBatchRow,
  MemberBatchImportError,
  MemberBatchImportResult,
} from "@/features/member-batch/types/memberBatch";

const MAX_BATCH_ROWS = 500;

const HEADER_ALIASES = {
  fullName: ["ho va ten", "ho ten", "ten khach hang", "fullname", "full name"],
  phone: ["so dien thoai", "dien thoai", "sdt", "phone", "phone number"],
  gender: ["gioi tinh", "gender", "sex"],
  birthDate: ["ngay sinh", "birthdate", "birth date", "date of birth"],
  email: ["email", "e-mail"],
  points: ["so diem can nap", "diem can nap", "so diem", "diem", "points", "point"],
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .trim()
    .toLocaleLowerCase("vi-VN")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function cellText(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value ?? "").trim();
}

function findHeaderIndexes(header: readonly unknown[]): Partial<Record<HeaderKey, number>> {
  const normalizedHeaders = header.map(normalizeText);
  return Object.fromEntries(
    Object.entries(HEADER_ALIASES).flatMap(([key, aliases]) => {
      const index = normalizedHeaders.findIndex((headerValue) =>
        aliases.includes(headerValue as never),
      );
      return index >= 0 ? [[key, index]] : [];
    }),
  ) as Partial<Record<HeaderKey, number>>;
}

function normalizePhone(value: unknown): string | null {
  let phone = cellText(value).replace(/[\s().-]/g, "");
  if (/^\d{9}$/.test(phone) && /^[35789]/.test(phone)) phone = `0${phone}`;
  return /^\+?\d{8,15}$/.test(phone) ? phone : null;
}

function normalizeGender(value: unknown): MemberRegistrationGender | null {
  const gender = normalizeText(value);
  if (["nam", "male", "m", "1"].includes(gender)) return "MALE";
  if (["nu", "female", "f", "2"].includes(gender)) return "FEMALE";
  return null;
}

function validIsoDate(year: number, month: number, day: number): string | null {
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== iso ||
    parsed.getTime() > Date.now()
  ) return null;
  return iso;
}

function normalizeBirthDate(value: unknown): string | null | "INVALID" {
  if (value === null || value === undefined || cellText(value) === "") return null;
  if (value instanceof Date) {
    return validIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate()) ?? "INVALID";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86_400_000);
    return validIsoDate(
      excelDate.getUTCFullYear(),
      excelDate.getUTCMonth() + 1,
      excelDate.getUTCDate(),
    ) ?? "INVALID";
  }

  const text = cellText(value);
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) return validIsoDate(Number(match[1]), Number(match[2]), Number(match[3])) ?? "INVALID";
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (match) return validIsoDate(Number(match[3]), Number(match[2]), Number(match[1])) ?? "INVALID";
  return "INVALID";
}

function normalizePoints(value: unknown): number | null {
  const raw = typeof value === "number"
    ? value
    : Number(cellText(value).replace(/[.,\s]/g, ""));
  return Number.isInteger(raw) && raw >= 0 && raw <= 10_000_000 ? raw : null;
}

function normalizeEmail(value: unknown): string | null {
  const email = cellText(value).toLocaleLowerCase("vi-VN");
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function requiredHeaderErrors(indexes: Partial<Record<HeaderKey, number>>): MemberBatchImportError[] {
  const labels: Record<Exclude<HeaderKey, "birthDate" | "email">, string> = {
    fullName: "Họ và tên",
    phone: "Số điện thoại",
    gender: "Giới tính",
    points: "Số điểm cần nạp",
  };
  return (Object.keys(labels) as Array<keyof typeof labels>)
    .filter((key) => indexes[key] === undefined)
    .map((key) => ({ rowNumber: null, message: `Thiếu cột bắt buộc “${labels[key]}”.` }));
}

export function parseMemberBatchRows(
  sheetRows: readonly (readonly unknown[])[],
): MemberBatchImportResult {
  if (sheetRows.length === 0) {
    return { rows: [], errors: [{ rowNumber: null, message: "File không có dữ liệu." }] };
  }

  const indexes = findHeaderIndexes(sheetRows[0]);
  const headerErrors = requiredHeaderErrors(indexes);
  if (headerErrors.length > 0) return { rows: [], errors: headerErrors };

  const rows: ImportedMemberBatchRow[] = [];
  const errors: MemberBatchImportError[] = [];
  const seenPhones = new Map<string, number>();
  const dataRows = sheetRows.slice(1).filter((row) => row.some((value) => cellText(value) !== ""));

  if (dataRows.length > MAX_BATCH_ROWS) {
    errors.push({
      rowNumber: null,
      message: `Mỗi lô chỉ hỗ trợ tối đa ${MAX_BATCH_ROWS} thành viên.`,
    });
  }

  for (const [offset, sourceRow] of dataRows.slice(0, MAX_BATCH_ROWS).entries()) {
    const rowNumber = offset + 2;
    const read = (key: HeaderKey): unknown => {
      const index = indexes[key];
      return index === undefined ? null : sourceRow[index];
    };
    const fullName = cellText(read("fullName"));
    const phone = normalizePhone(read("phone"));
    const gender = normalizeGender(read("gender"));
    const birthDate = normalizeBirthDate(read("birthDate"));
    const email = normalizeEmail(read("email"));
    const points = normalizePoints(read("points"));
    const rowErrors: string[] = [];

    if (!fullName || fullName.length > 120) rowErrors.push("Họ và tên không hợp lệ");
    if (!phone) rowErrors.push("Số điện thoại phải có 8–15 chữ số");
    if (!gender) rowErrors.push("Giới tính phải là Nam hoặc Nữ");
    if (birthDate === "INVALID") rowErrors.push("Ngày sinh phải là DD/MM/YYYY hoặc YYYY-MM-DD");
    if (email === null) rowErrors.push("Email không đúng định dạng");
    if (points === null) rowErrors.push("Số điểm phải là số nguyên từ 0 đến 10.000.000");
    if (phone && seenPhones.has(phone)) {
      rowErrors.push(`Trùng số điện thoại với dòng ${seenPhones.get(phone)}`);
    }

    if (rowErrors.length > 0 || !phone || !gender || points === null || email === null) {
      errors.push({ rowNumber, message: rowErrors.join("; ") });
      continue;
    }

    seenPhones.set(phone, rowNumber);
    rows.push({
      rowNumber,
      fullName,
      phone,
      gender,
      birthDate: birthDate === "INVALID" ? null : birthDate,
      email,
      points,
    });
  }

  if (dataRows.length === 0) {
    errors.push({ rowNumber: null, message: "File chỉ có tiêu đề, chưa có thành viên." });
  }
  return { rows, errors };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export async function readMemberBatchFile(file: File): Promise<MemberBatchImportResult> {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("vi-VN");
  if (extension === "csv") {
    return parseMemberBatchRows(parseCsv(await file.text().then((text) => text.replace(/^\uFEFF/, ""))));
  }
  if (extension !== "xlsx") {
    return {
      rows: [],
      errors: [{ rowNumber: null, message: "Chỉ hỗ trợ file .xlsx hoặc .csv." }],
    };
  }
  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  return parseMemberBatchRows(rows);
}

export function downloadMemberBatchTemplate(): void {
  const content = [
    "Họ và tên,Số điện thoại,Giới tính,Ngày sinh,Email,Số điểm cần nạp",
    "Nguyễn Văn A,0901234567,Nam,20/05/1990,a@example.com,100",
    "Trần Thị B,0901234568,Nữ,1995-08-12,,0",
  ].join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mau-dang-ky-the-thanh-vien.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
