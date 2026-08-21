import { RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import type { ReceiptSettings } from "@/features/receipt/types/receipt";
import type {
  CloseoutReport,
  CloseoutReportMeta,
} from "@/features/shift-close/types/closeout";

interface CloseoutReceiptDocumentProps {
  report: CloseoutReport;
  meta: CloseoutReportMeta;
  settings: ReceiptSettings;
}

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "3mm",
};

const CloseoutReceiptDocument: React.FC<CloseoutReceiptDocumentProps> = ({
  report,
  meta,
  settings,
}) => {
  const profile = RECEIPT_PAPER_PROFILES[settings.paperSize];
  const isCompact = profile.paperWidthMm <= 58;

  return (
    <article
      aria-label="Báo cáo kết ca"
      style={{
        boxSizing: "border-box",
        width: `${profile.printableWidthMm}mm`,
        padding: isCompact ? "3mm 0 5mm" : "4mm 0 6mm",
        background: "#fff",
        color: "#000",
        fontFamily: "Arial, sans-serif",
        fontSize: isCompact ? "10px" : "11px",
        lineHeight: 1.35,
      }}
    >
      <header style={{ textAlign: "center" }}>
        <div style={{ fontSize: isCompact ? "14px" : "16px", fontWeight: 900 }}>
          {settings.storeName || "JOY POS"}
        </div>
        {settings.storeAddress && <div style={{ marginTop: "1mm" }}>{settings.storeAddress}</div>}
        <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />
        <div style={{ fontSize: isCompact ? "13px" : "15px", fontWeight: 900 }}>
          BÁO CÁO KẾT CA
        </div>
      </header>

      <section style={{ display: "grid", gap: "1mm", marginTop: "3mm" }}>
        <div style={rowStyle}><span>Điểm bán</span><strong style={{ textAlign: "right" }}>{meta.warehouseName}</strong></div>
        <div style={rowStyle}><span>Kiểu báo cáo</span><strong>{meta.periodMode === "SHIFT" ? "Theo ca" : "Theo ngày"}</strong></div>
        <div style={rowStyle}><span>Từ</span><strong>{dateTimeFormatter.format(new Date(meta.startAt))}</strong></div>
        <div style={rowStyle}><span>Đến</span><strong>{dateTimeFormatter.format(new Date(meta.endAt))}</strong></div>
        <div style={rowStyle}><span>Tài khoản</span><strong style={{ textAlign: "right" }}>{meta.accountLabel}</strong></div>
        <div style={rowStyle}><span>Người in</span><strong style={{ textAlign: "right" }}>{meta.generatedBy}</strong></div>
      </section>

      <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />

      <section aria-label="Sản phẩm đã bán">
        <div style={{ ...rowStyle, fontWeight: 900, marginBottom: "2mm" }}>
          <span>SẢN PHẨM ĐÃ BÁN</span><span>SL</span>
        </div>
        <div style={{ display: "grid", gap: "1.5mm" }}>
          {report.products.length > 0 ? report.products.map((product, index) => (
            <div key={product.goodsId} style={rowStyle}>
              <span style={{ minWidth: 0 }}>{index + 1}. {product.goodsName}</span>
              <strong style={{ flexShrink: 0 }}>{product.quantity.toLocaleString("vi-VN")}</strong>
            </div>
          )) : <div style={{ textAlign: "center", padding: "2mm 0" }}>Không có sản phẩm đã bán</div>}
        </div>
        <div style={{ ...rowStyle, borderTop: "1px solid #000", marginTop: "2mm", paddingTop: "1.5mm", fontWeight: 800 }}>
          <span>Tổng số lượng</span><span>{report.productQuantity.toLocaleString("vi-VN")}</span>
        </div>
      </section>

      <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />

      <section aria-label="Doanh thu theo phương thức thanh toán">
        <div style={{ fontWeight: 900, marginBottom: "2mm" }}>PHƯƠNG THỨC THANH TOÁN</div>
        <div style={{ display: "grid", gap: "1.5mm" }}>
          {report.payments.map((payment) => (
            <div key={payment.paymentMethodId} style={rowStyle}>
              <span>{payment.paymentMethodName} ({payment.orderCount} đơn)</span>
              <strong>{moneyFormatter.format(payment.totalAmount)}</strong>
            </div>
          ))}
        </div>
      </section>

      <div style={{ borderTop: "2px solid #000", margin: "3mm 0 2mm" }} />
      <section style={{ display: "grid", gap: "1.5mm" }}>
        <div style={rowStyle}><strong>TỔNG ĐƠN</strong><strong>{report.orderCount.toLocaleString("vi-VN")}</strong></div>
        <div style={{ ...rowStyle, fontSize: isCompact ? "14px" : "16px", fontWeight: 900 }}>
          <span>TỔNG DOANH THU</span><span>{moneyFormatter.format(report.totalRevenue)}</span>
        </div>
      </section>

      <footer style={{ borderTop: "1px dashed #000", marginTop: "3mm", paddingTop: "2mm", textAlign: "center", fontSize: "0.9em" }}>
        Lập lúc {dateTimeFormatter.format(new Date(meta.fetchedAt))}
      </footer>
    </article>
  );
};

export default CloseoutReceiptDocument;
