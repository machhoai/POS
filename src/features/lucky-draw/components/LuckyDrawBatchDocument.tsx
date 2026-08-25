import LuckyDrawTicketDocument from "@/features/lucky-draw/components/LuckyDrawTicketDocument";
import { buildPrintableLuckyDrawTickets } from "@/features/lucky-draw/helpers/buildPrintableLuckyDrawTickets";
import type { LuckyDrawBatchDocumentProps } from "@/features/lucky-draw/types/luckyDraw";

const LuckyDrawBatchDocument: React.FC<LuckyDrawBatchDocumentProps> = ({
  order,
  settings,
  printableWidthMm,
  topMarginMm,
}) => (
  <>
    {buildPrintableLuckyDrawTickets(order).map((ticket) => (
      <LuckyDrawTicketDocument
        key={`${ticket.orderId}-${ticket.sequence}`}
        ticket={ticket}
        settings={settings}
        printableWidthMm={printableWidthMm}
        topMarginMm={topMarginMm}
      />
    ))}
  </>
);

export default LuckyDrawBatchDocument;
