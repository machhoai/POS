import type { CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import {
    calculateReceiptLine,
    calculateReceiptTotals,
} from "@/features/receipt/helpers/receiptCalculations";
import type {
    ReceiptDocumentProps,
    ReceiptFontWeight,
    ReceiptTheme,
} from "@/features/receipt/types/receipt";
import { buildInvoiceRequestUrl } from "@/features/receipt/helpers/invoiceRequestUrl";

function formatMoney(value: number): string {
    return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatTaxRate(value: number): string {
    return Number.isInteger(value)
        ? String(value)
        : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "3mm",
};

const labelStyle: CSSProperties = {
    flex: "1 1 auto",
    minWidth: 0,
};

const valueStyle: CSSProperties = {
    flex: "0 0 auto",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
};

interface ThemeOrnamentProps {
    theme: ReceiptTheme;
    fontWeight: ReceiptFontWeight;
    isCompact: boolean;
    placement: "top" | "bottom";
}



const ThemeOrnament: React.FC<ThemeOrnamentProps> = ({
    theme,
    fontWeight,
    isCompact,
    placement,
}) => {
    const lineStyle: CSSProperties = {
        flex: "1 1 auto",
        height: theme === "NATIONAL_DAY" ? "1.2mm" : "0",
        borderTop: "1px solid #000",
        borderBottom: theme === "NATIONAL_DAY" ? "1px solid #000" : undefined,
    };

    return (
        <div
            aria-hidden="true"
            style={{
                display: "flex",
                alignItems: "center",
                gap: isCompact ? "1.5mm" : "2mm",
                marginTop: placement === "bottom" ? "3.5mm" : "0",
                marginBottom: placement === "top" ? "3.5mm" : "0",
                fontWeight,
            }}
        >
            <span style={lineStyle} />
            {theme === "NATIONAL_DAY" ? (
                <span
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: isCompact ? "6mm" : "7mm",
                        height: isCompact ? "6mm" : "7mm",
                        border: "1.5px solid #000",
                        borderRadius: "50%",
                        fontSize: isCompact ? "11px" : "14px",
                        lineHeight: 1,
                    }}
                >
                    ★
                </span>
            ) : theme === "TET" ? (
                <span style={{ display: "flex", alignItems: "center", gap: "2mm", padding: "0 1mm" }}>
                    <span style={{ width: "2mm", height: "2mm", background: "#000", transform: "rotate(45deg)" }} />
                    <span style={{ width: "5mm", height: "5mm", border: "1.5px solid #000", transform: "rotate(45deg)", padding: "1mm" }}>
                        <span style={{ display: "block", width: "100%", height: "100%", background: "#000" }} />
                    </span>
                    <span style={{ width: "2mm", height: "2mm", background: "#000", transform: "rotate(45deg)" }} />
                </span>
            ) : (
                <span style={{ width: "3mm", height: "3mm", border: "1px solid #000", borderRadius: "50%" }} />
            )}
            <span style={lineStyle} />

        </div>
    );
};

interface ThemeMessageBannerProps {
    theme: ReceiptTheme;
    message: string;
    fontSizePt: number;
    fontWeight: ReceiptFontWeight;
    isCompact: boolean;
}

const VietnamFlagIcon: React.FC<{ heightMm?: number }> = ({ heightMm = 4 }) => {
    const widthMm = heightMm * 1.5;
    return (
        <svg
            viewBox="0 0 30 20"
            style={{
                width: `${widthMm}mm`,
                height: `${heightMm}mm`,
                display: "inline-block",
                verticalAlign: "middle",
                borderRadius: "0.5px",
                flexShrink: 0,
            }}
            aria-label="Lá cờ Việt Nam"
            role="img"
        >
            <rect width="30" height="20" fill="#DA251D" />
            <path
                d="M 15 4 L 16.347 8.146 L 20.706 8.146 L 17.18 10.708 L 18.527 14.854 L 15 12.292 L 11.473 14.854 L 12.82 10.708 L 9.294 8.146 L 13.653 8.146 Z"
                fill="#FFCD00"
            />
        </svg>
    );
};

const ThemeMessageBanner: React.FC<ThemeMessageBannerProps> = ({
    theme,
    message,
    fontSizePt,
    fontWeight,
    isCompact,
}) => {
    const marker = theme === "NATIONAL_DAY" ? "★" : theme === "TET" ? "◆" : "•";
    const border = theme === "NATIONAL_DAY"
        ? "3px double #000"
        : theme === "TET"
            ? "2px solid #000"
            : "1px dashed #000";

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1mm', flexDirection: 'column' }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: isCompact ? "1.5mm" : "2.5mm",
                    marginTop: "3mm",
                    padding: isCompact ? "0.8mm 0.5mm" : "0.2mm 1mm",
                    fontSize: `${fontSizePt}pt`,
                    fontWeight,
                    lineHeight: 1.25,
                    letterSpacing: theme === "NATIONAL_DAY" ? "0.25px" : "0",
                    textAlign: "center",
                }}
            >
                <span aria-hidden="true">{marker}</span>
                <span>{message}</span>
                <span aria-hidden="true">{marker}</span>
            </div>
            {
                theme === "NATIONAL_DAY" && <VietnamFlagIcon />
            }
        </div>
    );
};

const ReceiptDocument: React.FC<ReceiptDocumentProps> = ({
    order,
    settings,
    invoiceRequestUrlOverride,
}) => {
    const profile = RECEIPT_PAPER_PROFILES[settings.paperSize];
    const isCompact = settings.paperSize === "POS58";
    const fontWeights = settings.fontWeights;
    const logoWidthMm = Math.min(
        Math.max(12, settings.logoWidthMm),
        profile.printableWidthMm - (isCompact ? 6 : 8),
    );
    const invoiceQrSizeMm = Math.min(
        Math.max(22, settings.invoiceQrSizeMm),
        profile.printableWidthMm - (isCompact ? 8 : 12),
    );
    const totals = calculateReceiptTotals(order, settings.defaultTaxRate);
    const invoiceRequestUrl = invoiceRequestUrlOverride || buildInvoiceRequestUrl(order);
    const themeMessage = settings.themeMessages[settings.theme]?.trim() ?? "";
    const borderStyle = settings.theme === "NATIONAL_DAY"
        ? "1px solid #000"
        : settings.theme === "TET"
            ? "2px solid #000"
            : "1px solid #000";

    return (
        <article
            aria-label={`Biên lai ${order.localOrderId}`}
            style={{
                boxSizing: "border-box",
                width: `${profile.printableWidthMm}mm`,
                minHeight: "40mm",
                padding: isCompact ? "3mm" : "4mm",
                background: "#fff",
                color: "#000",
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: isCompact ? "10px" : "11.5px",
                lineHeight: 1.35,
                overflowWrap: "anywhere",
            }}
        >

            <header style={{ textAlign: "center" }}>
                {settings.showLogo && settings.logoDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={settings.logoDataUrl}
                        alt="Logo cửa hàng"
                        style={{
                            display: "block",
                            width: `${logoWidthMm}mm`,
                            maxHeight: `${settings.logoMaxHeightMm}mm`,
                            objectFit: "contain",
                            filter: `grayscale(1) contrast(${settings.logoContrastPercent}%)`,
                            margin: "0 auto 2mm",
                        }}
                    />
                )}
                <div style={{ fontSize: isCompact ? "15px" : "18px", fontWeight: fontWeights.storeName }}>
                    {settings.storeName || "JOY POS"}
                </div>
                {settings.storeAddress && (
                    <div style={{ marginTop: "0.8mm", fontWeight: fontWeights.storeDetails }}>{settings.storeAddress}</div>
                )}
                {settings.showContact && settings.hotline && (
                    <div style={{ marginTop: "0.5mm", fontWeight: fontWeights.storeDetails }}>Hotline: {settings.hotline}</div>
                )}
                {settings.showThemeMessage && themeMessage && (
                    <ThemeMessageBanner
                        theme={settings.theme}
                        message={themeMessage}
                        fontSizePt={settings.themeMessageFontSizePt}
                        fontWeight={fontWeights.themeMessage}
                        isCompact={isCompact}
                    />
                )}
                <div
                    style={{
                        borderTop: borderStyle,
                        borderBottom: borderStyle,
                        fontSize: isCompact ? "12px" : "14px",
                        fontWeight: fontWeights.receiptTitle,
                        letterSpacing: "0.5px",
                        margin: "3mm 0",
                        padding: "1.5mm 0",
                    }}
                >
                    Biên lai bán hàng
                </div>
            </header>

            <section style={{ display: "grid", gap: "0.8mm", fontWeight: fontWeights.orderInfo }}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Mã đơn:</span>
                    <strong style={{ ...valueStyle, fontFamily: "monospace", fontWeight: fontWeights.orderInfo }}>
                        {order.localOrderId}
                    </strong>
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Ngày giờ:</span>
                    <span style={valueStyle}>{formatDateTime(order.paidAt || order.createdAt)}</span>
                </div>
                {settings.showCashier && order.operatorName && (
                    <div style={rowStyle}>
                        <span style={labelStyle}>Nhân viên:</span>
                        <span style={valueStyle}>{order.operatorName}</span>
                    </div>
                )}
                <div style={rowStyle}>
                    <span style={labelStyle}>Thanh toán:</span>
                    <span style={valueStyle}>
                        {order.paymentMethodName || (order.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản")}
                    </span>
                </div>
            </section>

            <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />

            <section aria-label="Hàng hóa đã mua">
                <div style={{ ...rowStyle, fontWeight: fontWeights.tableHeader, marginBottom: "1.8mm" }}>
                    <span style={labelStyle}>HÀNG HÓA</span>
                    <span style={valueStyle}>THÀNH TIỀN</span>
                </div>
                <div style={{ display: "grid", gap: isCompact ? "2.5mm" : "2mm" }}>
                    {order.items.map((item) => {
                        const line = calculateReceiptLine(item, settings.defaultTaxRate);
                        return (
                            <div key={item.goodsId}>
                                <div style={{ fontWeight: fontWeights.itemName }}>{item.goodsName}</div>
                                <div style={{ ...rowStyle, marginTop: "0.5mm", fontWeight: fontWeights.itemDetails }}>
                                    <span style={labelStyle}>
                                        {item.quantity} × {formatMoney(item.price)}
                                    </span>
                                    <span style={valueStyle}>
                                        {formatMoney(line.lineTotal)}
                                    </span>
                                </div>
                                {settings.showItemTax && (
                                    <div style={{ ...rowStyle, marginTop: "0.5mm", fontSize: "0.92em", fontWeight: fontWeights.itemTax }}>
                                        <span style={labelStyle}>Thuế {formatTaxRate(line.taxRate)}%</span>
                                        <span style={valueStyle}>{formatMoney(line.taxAmount)}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />

            <section style={{ display: "grid", gap: "1mm", fontWeight: fontWeights.summary }}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Tạm tính</span>
                    <span style={valueStyle}>{formatMoney(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                    <div style={rowStyle}>
                        <span style={labelStyle}>
                            Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ""}
                        </span>
                        <span style={valueStyle}>-{formatMoney(totals.discount)}</span>
                    </div>
                )}
                <div style={{ ...rowStyle, fontWeight: fontWeights.taxTotal }}>
                    <span style={labelStyle}>Tổng tiền thuế</span>
                    <span style={valueStyle}>{formatMoney(totals.taxTotal)}</span>
                </div>
                <div
                    style={{
                        ...rowStyle,
                        borderTop: "2px solid #000",
                        marginTop: "1mm",
                        paddingTop: "1.5mm",
                        fontSize: isCompact ? "14px" : "16px",
                        fontWeight: fontWeights.grandTotal,
                    }}
                >
                    <span style={labelStyle}>TỔNG TIỀN</span>
                    <span style={valueStyle}>{formatMoney(totals.grandTotal)}</span>
                </div>
            </section>

            <footer style={{ marginTop: "4mm", textAlign: "center" }}>
                {invoiceRequestUrl && settings.showInvoiceRequestQr && (
                    <section
                        aria-label="Yêu cầu xuất hóa đơn"
                        style={{
                            borderTop: "1px dashed #000",
                            paddingTop: "3mm",
                            marginBottom: "3mm",
                        }}
                    >
                        <div
                            style={{
                                fontSize: `${settings.invoiceQrTitleFontSizePt}pt`,
                                fontWeight: fontWeights.invoiceQrTitle,
                            }}
                        >
                            Quét mã để yêu cầu xuất hóa đơn
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", margin: "2mm 0" }}>
                            <QRCodeSVG
                                value={invoiceRequestUrl}
                                size={256}
                                level="M"
                                marginSize={1}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                title="Mã QR yêu cầu xuất hóa đơn"
                                style={{
                                    width: `${invoiceQrSizeMm}mm`,
                                    height: `${invoiceQrSizeMm}mm`,
                                }}
                            />
                        </div>
                        <div
                            style={{
                                fontSize: `${settings.invoiceQrHintFontSizePt}pt`,
                                fontWeight: fontWeights.invoiceQrHint,
                            }}
                        >
                            Vui lòng điền thông tin xuất hóa đơn trước 22:30 cùng ngày.
                        </div>
                    </section>
                )}
                {settings.showContact && settings.afterSalesText && (
                    <div style={{ borderTop: "1px dashed #000", paddingTop: "3mm", fontWeight: fontWeights.footer }}>
                        {settings.afterSalesText}
                    </div>
                )}
                {settings.footerMessage && (
                    <div style={{ marginTop: "2.5mm", fontWeight: fontWeights.footer }}>
                        {settings.footerMessage}
                    </div>
                )}
            </footer>
        </article>
    );
};

export default ReceiptDocument;
