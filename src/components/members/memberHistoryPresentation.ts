import type { IconType } from "react-icons";
import {
  IoGameControllerOutline,
  IoGiftOutline,
  IoLeafOutline,
  IoRepeatOutline,
  IoStarOutline,
  IoTicketOutline,
} from "react-icons/io5";
import type { MemberStoredValueCategory } from "@/lib/types/member";

interface MemberHistoryCategoryPresentation {
  label: string;
  unit: string;
  icon: IconType;
  badgeClassName: string;
  iconClassName: string;
}

export const memberHistoryCategories: Record<
  MemberStoredValueCategory,
  MemberHistoryCategoryPresentation
> = {
  1: {
    label: "Tiền",
    unit: "đ",
    icon: IoGameControllerOutline,
    badgeClassName: "bg-orange-50 text-orange-700",
    iconClassName: "bg-orange-100 text-orange-700",
  },
  2: {
    label: "Điểm thưởng",
    unit: "điểm thưởng",
    icon: IoGiftOutline,
    badgeClassName: "bg-amber-50 text-amber-700",
    iconClassName: "bg-amber-100 text-amber-700",
  },
  4: {
    label: "Điểm",
    unit: "điểm",
    icon: IoTicketOutline,
    badgeClassName: "bg-sky-50 text-sky-700",
    iconClassName: "bg-sky-100 text-sky-700",
  },
  5: {
    label: "Điểm tích lũy",
    unit: "điểm tích lũy",
    icon: IoStarOutline,
    badgeClassName: "bg-violet-50 text-violet-700",
    iconClassName: "bg-violet-100 text-violet-700",
  },
  6: {
    label: "Lượt",
    unit: "lượt",
    icon: IoRepeatOutline,
    badgeClassName: "bg-orange-50 text-orange-700",
    iconClassName: "bg-orange-100 text-orange-700",
  },
  7: {
    label: "Vé xanh",
    unit: "vé xanh",
    icon: IoLeafOutline,
    badgeClassName: "bg-emerald-50 text-emerald-700",
    iconClassName: "bg-emerald-100 text-emerald-700",
  },
};
