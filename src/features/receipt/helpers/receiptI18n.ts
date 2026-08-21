import type { PaymentMethod } from "@/lib/types/order";
import type { ReceiptLanguage, ReceiptTheme } from "@/features/receipt/types/receipt";

export interface ReceiptCopy {
    documentLabel: string;
    logoAlt: string;
    hotline: string;
    receiptTitle: string;
    orderId: string;
    dateTime: string;
    cashier: string;
    customer: string;
    phone: string;
    memberCode: string;
    memberLevel: string;
    payment: string;
    purchasedItems: string;
    goods: string;
    amount: string;
    tax: string;
    subtotal: string;
    discount: string;
    taxTotal: string;
    grandTotal: string;
    invoiceRequest: string;
    invoiceRequestQr: string;
    invoiceRequestHint: string;
    paymentMethods: Record<PaymentMethod, string>;
}

const RECEIPT_COPY: Record<ReceiptLanguage, ReceiptCopy> = {
    vi: {
        documentLabel: "Biên lai",
        logoAlt: "Logo cửa hàng",
        hotline: "Hotline",
        receiptTitle: "Biên lai bán hàng",
        orderId: "Mã đơn",
        dateTime: "Ngày giờ",
        cashier: "Nhân viên",
        customer: "Khách hàng",
        phone: "Điện thoại",
        memberCode: "Mã thành viên",
        memberLevel: "Hạng thành viên",
        payment: "Thanh toán",
        purchasedItems: "Hàng hóa đã mua",
        goods: "HÀNG HÓA",
        amount: "THÀNH TIỀN",
        tax: "Thuế",
        subtotal: "Tạm tính",
        discount: "Giảm giá",
        taxTotal: "Tổng tiền thuế",
        grandTotal: "TỔNG TIỀN",
        invoiceRequest: "Yêu cầu xuất hóa đơn",
        invoiceRequestQr: "Quý khách vui lòng quét mã để yêu cầu xuất hóa đơn",
        invoiceRequestHint: "Xuất hóa đơn chỉ có hiệu lực đến 22:30 cùng ngày.",
        paymentMethods: { CASH: "Tiền mặt", QR_CODE: "Chuyển khoản" },
    },
    en: {
        documentLabel: "Receipt",
        logoAlt: "Store logo",
        hotline: "Hotline",
        receiptTitle: "Sales receipt",
        orderId: "Order ID",
        dateTime: "Date & time",
        cashier: "Cashier",
        customer: "Customer",
        phone: "Phone",
        memberCode: "Member ID",
        memberLevel: "Member tier",
        payment: "Payment",
        purchasedItems: "Purchased items",
        goods: "ITEMS",
        amount: "AMOUNT",
        tax: "Tax",
        subtotal: "Subtotal",
        discount: "Discount",
        taxTotal: "Total tax",
        grandTotal: "TOTAL",
        invoiceRequest: "Invoice request",
        invoiceRequestQr: "Scan to request an invoice",
        invoiceRequestHint: "Invoice requests are only valid until 10:30 PM today.",
        paymentMethods: { CASH: "Cash", QR_CODE: "Bank transfer" },
    },
    zh: {
        documentLabel: "收据",
        logoAlt: "门店标志",
        hotline: "客服热线",
        receiptTitle: "销售收据",
        orderId: "订单号",
        dateTime: "日期时间",
        cashier: "收银员",
        customer: "顾客",
        phone: "电话",
        memberCode: "会员编号",
        memberLevel: "会员等级",
        payment: "支付方式",
        purchasedItems: "已购商品",
        goods: "商品",
        amount: "金额",
        tax: "税费",
        subtotal: "小计",
        discount: "优惠",
        taxTotal: "税费合计",
        grandTotal: "总计",
        invoiceRequest: "申请发票",
        invoiceRequestQr: "扫码申请发票",
        invoiceRequestHint: "申请发票只在当天22:30前有效。",
        paymentMethods: { CASH: "现金", QR_CODE: "银行转账" },
    },
};

const LOCALES: Record<ReceiptLanguage, string> = {
    vi: "vi-VN",
    en: "en-US",
    zh: "zh-CN",
};

const KNOWN_SETTING_TEXT: Record<ReceiptLanguage, Record<string, string>> = {
    vi: {},
    en: {
        "Địa chỉ cửa hàng": "Store address",
        "Hỗ trợ sau bán hàng: vui lòng giữ lại biên lai này.":
            "After-sales support: please keep this receipt.",
        "Cảm ơn Quý khách và hẹn gặp lại!": "Thank you and see you again!",
        "Chúc mừng ngày Quốc khánh 2/9": "Happy Vietnam National Day!",
        "Chúc mừng năm mới – An khang thịnh vượng":
            "Happy New Year – Wishing you prosperity and good health!",
    },
    zh: {
        "Địa chỉ cửa hàng": "门店地址",
        "Hỗ trợ sau bán hàng: vui lòng giữ lại biên lai này.":
            "售后服务：请妥善保管此收据。",
        "Cảm ơn Quý khách và hẹn gặp lại!": "感谢您的光临，期待再次见到您！",
        "Chúc mừng ngày Quốc khánh 2/9": "越南国庆节快乐！",
        "Chúc mừng năm mới – An khang thịnh vượng":
            "新年快乐，祝您平安健康、万事兴旺！",
    },
};

const DEFAULT_THEME_MESSAGES: Record<ReceiptTheme, string> = {
    CLASSIC: "",
    NATIONAL_DAY: "Chúc mừng ngày Quốc khánh 2/9",
    TET: "Chúc mừng năm mới – An khang thịnh vượng",
};

export function getReceiptCopy(language: ReceiptLanguage): ReceiptCopy {
    return RECEIPT_COPY[language];
}

export function getReceiptLocale(language: ReceiptLanguage): string {
    return LOCALES[language];
}

export function translateKnownSettingText(
    value: string,
    language: ReceiptLanguage,
): string {
    return KNOWN_SETTING_TEXT[language][value] ?? value;
}

export function getLocalizedThemeMessage(
    theme: ReceiptTheme,
    value: string,
    language: ReceiptLanguage,
): string {
    const normalizedValue = value.trim();
    if (normalizedValue !== DEFAULT_THEME_MESSAGES[theme]) return normalizedValue;
    return translateKnownSettingText(normalizedValue, language);
}
