import type { CustomerDisplayAdvertisement } from "@/lib/types/customerDisplay";

export const CUSTOMER_DISPLAY_ADVERTISEMENTS: readonly CustomerDisplayAdvertisement[] = [
  {
    id: "morning-combo",
    badge: "Gợi ý hôm nay",
    title: "Bắt đầu ngày mới thật vui",
    description: "Thưởng thức combo đồ uống và món nhẹ được yêu thích tại cửa hàng.",
    highlight: "Tiện lợi • Nhanh chóng • Tươi ngon",
    icon: "COFFEE",
    tone: "ORANGE",
  },
  {
    id: "member-gift",
    badge: "Ưu đãi thành viên",
    title: "Tích điểm cho mỗi lần mua sắm",
    description: "Đừng quên cung cấp thông tin thành viên để nhận thêm nhiều quyền lợi.",
    highlight: "Mua sắm nhiều hơn, nhận quà nhiều hơn",
    icon: "GIFT",
    tone: "EMERALD",
  },
  {
    id: "happy-shopping",
    badge: "Joy World",
    title: "Cảm ơn bạn đã ghé thăm",
    description: "Chúng tôi luôn sẵn sàng mang đến trải nghiệm mua sắm nhanh và dễ dàng.",
    highlight: "Chúc bạn một ngày thật nhiều niềm vui",
    icon: "SPARKLES",
    tone: "SKY",
  },
] as const;
