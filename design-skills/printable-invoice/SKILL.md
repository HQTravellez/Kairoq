---
name: Printable invoice
description: A4 invoices, receipts and quotes generated from the app's own data, with line items, tax, totals, payment details and clean print styles.
group: Page types
---
# Printable invoice

An invoice is a legal and financial document first and a design object second. It must be correct, easy to scan, and print perfectly on one A4 page (or continue cleanly onto a second). Small businesses send these to guests, clients and customers, so it should also look calm and trustworthy, like good stationery.

## Purpose
- Build an `Invoice` (or `Receipt`, `Quote`) React component that takes a document object from the app's data: number, issue date, due date, seller, customer, line items, tax rates, discounts, currency, payment status and notes. Never hard-code amounts, prices or tax rates in the markup; every number comes from props or the store.
- Compute line totals, subtotal, tax per rate, discounts and the grand total in one helper function, and format with `Intl.NumberFormat(locale, { style: 'currency', currency })`. Round per line and at the total consistently.
- Provide a route such as `/invoices/:id` with a toolbar (Back, Download PDF via `window.print()`, Mark as paid, Send) that is hidden when printing.

## Layout
- Page container that simulates A4 on screen: `mx-auto w-full max-w-[210mm] min-h-[297mm] bg-white p-[16mm] shadow-sm`, on a muted app background so it reads as paper.
- Header row: business logo and name on the left (from settings), the document title "Invoice" in large type on the right with the number, issue date and due date in a small two-column definition list.
- Two address blocks side by side: "From" (business name, address, tax or registration number, email) and "Bill to" (customer name, company, address). Use small uppercase labels (text-[11px] uppercase tracking-wider text-muted-foreground).
- Line items table: Description (with an optional muted second line for dates of stay, SKU or notes), Qty, Unit price, Tax, Amount. Numbers right-aligned with `tabular-nums`. Thin row borders, no zebra stripes, a heavier rule under the header.
- Totals block aligned right (w-64 ml-auto): Subtotal, discount, each tax rate on its own line, then Total in larger semibold type with a top border. Show "Amount paid" and "Balance due" when deposits exist.
- Payment section: bank details or payment link, reference to quote, terms (for example "Due within 14 days"), and a short thank-you note. A status stamp (Paid, Overdue, Draft) as a rotated outline badge is a nice touch, driven by status.
- Footer: small legal text, registration details and page number.

## Palette and type
- Black and grey on white with one brand accent (`hsl(var(--brand))`) for the title rule, the total and links. Keep contrast high so faxed or photocopied copies stay legible.
- A clean sans (Inter, IBM Plex Sans, Manrope) at 10-11pt for body; numbers in the same face with tabular figures. Optional serif for the business name if the brand is classic (hotel, restaurant).

## Print CSS
- In the global stylesheet:
  `@page { size: A4; margin: 0; }`
  `@media print { body { background: white; } .no-print { display: none !important; } .invoice-page { box-shadow: none; margin: 0; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`
- Use `break-inside: avoid` on table rows and the totals block; repeat the table header on the next page with `thead { display: table-header-group; }`.
- Units in mm or pt for the printed page so it does not depend on screen width.

## Details
- Multi-currency and locale aware dates (`toLocaleDateString`). Show the currency code next to the total.
- Empty states: an invoice with no items shows a friendly placeholder row, not a broken table.
- Accessibility: real `<table>` markup with `<th scope="col">`, sufficient font sizes on screen.
- Lists of invoices use a table with status badges and filters; the printable view is a separate component.

## Avoid
- Hard-coded prices, taxes or currency symbols, background images, heavy colour fills that waste ink, more than one accent, centred tables, totals that are computed in several places and drift apart, and toolbars that appear in the printout.
