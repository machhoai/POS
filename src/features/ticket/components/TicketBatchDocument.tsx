"use client";

import TicketDocument from "@/features/ticket/components/TicketDocument";
import { buildPrintableTickets } from "@/features/ticket/helpers/buildPrintableTickets";
import type { TicketBatchDocumentProps } from "@/features/ticket/types/ticket";

const TicketBatchDocument: React.FC<TicketBatchDocumentProps> = ({
  order,
  settings,
  printableWidthMm,
  topMarginMm,
}) => (
  <div data-ticket-batch>
    {buildPrintableTickets(order).map((ticket) => (
      <TicketDocument
        key={ticket.ticketCode}
        ticket={ticket}
        settings={settings}
        printableWidthMm={printableWidthMm}
        topMarginMm={topMarginMm}
      />
    ))}
  </div>
);

export default TicketBatchDocument;
