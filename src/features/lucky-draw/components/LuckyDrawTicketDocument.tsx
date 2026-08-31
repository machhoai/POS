import OrderBarcode from "@/features/lucky-draw/components/OrderBarcode";
import { LUCKY_DRAW_TICKET_HEIGHT_MM } from "@/features/lucky-draw/config/luckyDrawConfig";
import { RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import type { LuckyDrawTicketDocumentProps } from "@/features/lucky-draw/types/luckyDraw";

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

const LuckyDrawTicketDocument: React.FC<LuckyDrawTicketDocumentProps> = ({
    ticket,
    settings,
    printableWidthMm,
    topMarginMm = 0,
}) => {
    const width = printableWidthMm ?? RECEIPT_PAPER_PROFILES[settings.paperSize].printableWidthMm;
    const compact = settings.paperSize === "POS58";
    const rowStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: compact ? "25mm 1fr" : "30mm 1fr",
        gap: "2mm",
        alignItems: "start",
        fontSize: compact ? "8pt" : "8.5pt",
        lineHeight: 1,
    };

    return (
        <article
            data-lucky-draw-ticket-page
            style={{
                width: `${width}mm`,
                height: `${LUCKY_DRAW_TICKET_HEIGHT_MM}mm`,
                padding: `${Math.max(0, topMarginMm)}mm 3mm 3mm`,
                background: "#fff",
                color: "#000",
                fontFamily: "Arial, sans-serif",
                overflow: "hidden",
                breakAfter: "page",
                pageBreakAfter: "always",
            }}
        >
            <div style={{ height: "100%", padding: "0mm", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "start", gap: "2px" }}>
                    <img src="/images/logo/cityfuns_logo.png" style={{ width: "auto", height: "40px", marginBottom: "5px" }} alt="logo" />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <p style={{ margin: "0 0 2px", textAlign: "center", fontSize: compact ? "7pt" : "8pt", fontWeight: 600, letterSpacing: ".04em" }}>{settings.programName}</p>
                        <h1 style={{ margin: "0 0 2px", textAlign: "center", fontSize: compact ? "10pt" : "12pt", lineHeight: 1.08, fontWeight: 600 }}>{settings.ticketTitle}</h1>
                        <p style={{ margin: "0 0 0px", textAlign: "center", fontSize: "7.5pt", fontWeight: 600 }}>Phiếu {ticket.sequence}/{ticket.totalForOrder}</p>
                    </div>
                </div>

                <div style={{ borderTop: "0.3mm dashed #000", margin: "1.5mm 0", paddingTop: "1.5mm", display: "grid", gap: "1.5mm" }}>
                    <div style={rowStyle}><strong>Khách hàng</strong><span style={{ overflowWrap: "anywhere" }}>{ticket.customerName}</span></div>
                    <div style={rowStyle}><strong>Số điện thoại</strong><span>{ticket.customerPhone}</span></div>
                    <div style={rowStyle}><strong>Mã đơn hàng</strong><span style={{ overflowWrap: "anywhere", fontWeight: 700 }}>{ticket.orderId}</span></div>
                    {/* <div style={rowStyle}><strong>Ngày mua</strong><span>{formatDateTime(ticket.purchasedAt)}</span></div> */}
                    <div style={rowStyle}><strong>Sản phẩm</strong><span style={{ overflowWrap: "anywhere" }}>{ticket.goodsName}</span></div>
                </div>

                <p style={{ margin: "0 0 2mm", textAlign: "center", fontSize: compact ? "7pt" : "7.5pt", lineHeight: 1.3 }}>{settings.message}</p>
                <div style={{ marginTop: "auto" }}>
                    <OrderBarcode value={ticket.orderId} height={compact ? 36 : 42} />
                    <p style={{ margin: "1mm 0 0", textAlign: "center", fontFamily: "monospace", fontSize: compact ? "7pt" : "8pt", fontWeight: 700, letterSpacing: ".04em" }}>{ticket.orderId}</p>
                    <p style={{ margin: "2mm 0 0", borderTop: "0.25mm solid #000", paddingTop: "1.5mm", textAlign: "center", fontSize: "7.5pt", fontWeight: 700 }}>{settings.footerMessage}</p>
                </div>
            </div>
        </article>
    );
};

export default LuckyDrawTicketDocument;
