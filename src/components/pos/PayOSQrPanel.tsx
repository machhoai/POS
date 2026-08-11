/* eslint-disable @next/next/no-img-element */
import { QRCodeSVG } from "qrcode.react";
import type { PayOSCheckoutController } from "@/lib/types/payment";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface PayOSQrPanelProps {
  payment: PayOSCheckoutController;
}
function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function StatusMessage({ payment }: PayOSQrPanelProps) {
  if (payment.errorMessage) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        {payment.errorMessage}
      </div>
    );
  }
  if (payment.nextAction === "COMPLETED") {
    return <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Thanh toán thành công. Đang hoàn tất đơn hàng...</div>;
  }
  if (payment.nextAction === "RETRY_DISPLAY") {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">Đã hết lượt chờ 5 phút. Mã vẫn còn hiệu lực.</div>;
  }
  if (payment.nextAction === "RECREATE") {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">Mã thanh toán đã hết hạn hoặc bị hủy.</div>;
  }
  return <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Đang chờ khách hàng chuyển khoản...</div>;
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="break-words text-right text-sm font-bold text-slate-900">{value}</dd>
    </div>
  );
}
function FixedTransferPanel({ payment }: PayOSQrPanelProps) {
  const transfer = payment.fixedTransfer;
  if (!transfer || transfer.status !== "AWAITING_MANUAL_CONFIRMATION") {
    return null;
  }
  const fixedOnly = transfer.reason === "FIXED_TRANSFER_ONLY";

  return (
    <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(360px,1.15fr)]">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <img
            src={transfer.qrImageUrl}
            width={300}
            height={356}
            alt="Mã QR chuyển khoản vào tài khoản cố định"
            className="h-auto w-[300px] max-w-full"
          />
        </div>
        <p className="mt-3 text-center text-sm font-bold text-amber-900">
          QR tài khoản cố định · Xác nhận bằng nút bấm
        </p>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {fixedOnly
            ? "Điểm bán đang chỉ dùng QR cố định, không tạo mã PayOS và không xác nhận tự động."
            : "PayOS không cung cấp được mã QR. Sau khi khách chuyển khoản, nhân viên phải kiểm tra thông tin và xác nhận thủ công."}
        </div>
        <dl className="rounded-2xl border border-slate-200 bg-white px-4">
          <DetailRow label="Số tiền" value={formatCurrency(transfer.amount)} />
          <DetailRow label="Chủ tài khoản" value={transfer.accountName} />
          <DetailRow label="Số tài khoản" value={transfer.accountNumber} />
          <DetailRow label="Ngân hàng (BIN)" value={transfer.bankBin} />
          <DetailRow label="Nội dung" value={transfer.description} />
        </dl>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void payment.confirmManually()}
            disabled={payment.isBusy}
            className="min-h-12 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {payment.isBusy ? "Đang hoàn tất..." : "Xác nhận khách đã chuyển khoản"}
          </button>
          <button
            type="button"
            onClick={() => void payment.cancelPayment()}
            disabled={payment.isBusy}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy thanh toán và sửa giỏ
          </button>
        </div>
        <p className="text-xs font-semibold leading-5 text-red-600">
          Đơn sau khi hoàn tất sẽ được đánh dấu “Chưa được xác nhận thanh toán” trong lịch sử.
        </p>
      </div>
    </section>
  );
}

export default function PayOSQrPanel({ payment }: PayOSQrPanelProps) {
  if (payment.fixedTransfer?.status === "AWAITING_MANUAL_CONFIRMATION") {
    return <FixedTransferPanel payment={payment} />;
  }
  const session = payment.session;
  if (!session) {
    return (
      <section className="m-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h3 className="text-lg font-extrabold text-amber-900">Chưa tải được mã QR</h3>
        <p className="text-sm leading-6 text-amber-800">
          Đơn hàng và giỏ hàng vẫn được giữ an toàn. Bạn có thể thử khôi phục mã,
          hoặc hủy mã trên PayOS trước khi quay lại chỉnh sửa giỏ hàng.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => void payment.createPayment()} disabled={payment.isBusy} className="min-h-12 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50">
            {payment.isBusy ? "Đang khôi phục..." : "Thử khôi phục mã"}
          </button>
          <button type="button" onClick={() => void payment.cancelPayment()} disabled={payment.isBusy} className="min-h-12 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 disabled:opacity-50">
            Hủy thanh toán và sửa giỏ
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(360px,1.15fr)]">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          {session.qrCode ? (
            <QRCodeSVG
              value={session.qrCode}
              size={280}
              level="M"
              marginSize={1}
              aria-label="Mã QR chuyển khoản PayOS"
            />
          ) : (
            <div className="flex size-[280px] items-center justify-center text-center text-sm text-slate-500">
              Chưa nhận được dữ liệu QR từ PayOS.
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-sm font-medium text-slate-600">
          Mở ứng dụng ngân hàng và quét mã để thanh toán
        </p>
        <div className="mt-3 rounded-full bg-slate-900 px-5 py-2 font-mono text-2xl font-extrabold tabular-nums text-white">
          {formatCountdown(payment.remainingSeconds)}
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <StatusMessage payment={payment} />
        <dl className="rounded-2xl border border-slate-200 bg-white px-4">
          <DetailRow label="Số tiền" value={formatCurrency(session.amount)} />
          <DetailRow label="Chủ tài khoản" value={session.accountName || "Chưa có thông tin"} />
          <DetailRow label="Số tài khoản" value={session.accountNumber || "Chưa có thông tin"} />
          <DetailRow label="Ngân hàng (BIN)" value={session.bin || "Chưa có thông tin"} />
          <DetailRow label="Nội dung" value={session.description} />
        </dl>

        <div className="grid gap-2 sm:grid-cols-2">
          {payment.nextAction === "WAIT" && (
            <button type="button" onClick={() => void payment.checkPayment()} disabled={payment.isBusy} className="min-h-12 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
              {payment.isBusy ? "Đang kiểm tra..." : "Kiểm tra trạng thái thanh toán"}
            </button>
          )}
          {payment.nextAction === "RETRY_DISPLAY" && (
            <button type="button" onClick={() => void payment.retryDisplay()} disabled={payment.isBusy} className="min-h-12 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50">
              Thử lại
            </button>
          )}
          {payment.nextAction === "RECREATE" && (
            <button type="button" onClick={() => void payment.recreatePayment()} disabled={payment.isBusy} className="min-h-12 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50">
              {payment.isBusy ? "Đang tạo mã..." : "Tạo lại mã thanh toán"}
            </button>
          )}
          {payment.canConfirmManually && (
            <button type="button" onClick={() => void payment.confirmManually()} disabled={payment.isBusy} className="min-h-12 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50">
              Xác nhận thủ công (ngoại lệ)
            </button>
          )}
          {payment.nextAction !== "COMPLETED" && (
            <button type="button" onClick={() => void payment.cancelPayment()} disabled={payment.isBusy} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Hủy thanh toán và sửa giỏ
            </button>
          )}
        </div>
        {payment.canConfirmManually && (
          <p className="text-xs leading-5 text-red-600">
            Chỉ dùng sau khi đã kiểm tra giao dịch thực tế. Đơn sẽ được đánh dấu “Chưa được xác nhận thanh toán”.
          </p>
        )}
      </div>
    </section>
  );
}
