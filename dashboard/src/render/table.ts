import { setText } from "../security/dom";
import type { Widget } from "../domain/widgets";
import { applyTone, clamp, el } from "./helpers";

type TableWidget = Extract<Widget, { type: "table" }>;
type Column = TableWidget["data"]["columns"][number];
type Cell = TableWidget["data"]["rows"][number][string];

function renderCell(cell: Cell | undefined, column: Column): HTMLElement {
  const td = el("td", `cc-table__cell cc-table__cell--${column.type}`);
  if (cell === undefined) return td;

  if (typeof cell === "string") {
    setText(td, cell);
    return td;
  }
  if (typeof cell === "number") {
    setText(td, column.unit ? `${String(cell)} ${column.unit}` : String(cell));
    return td;
  }
  if ("text" in cell) {
    const badge = el("span", "cc-badge", cell.text);
    applyTone(badge, cell.tone);
    td.appendChild(badge);
    return td;
  }
  // progress cell: { value }
  const percent = Math.round(clamp(cell.value, 0, 1) * 100);
  const bar = el("span", "cc-table__progress");
  bar.style.width = `${String(percent)}%`;
  td.appendChild(bar);
  return td;
}

export function renderTable(host: HTMLElement, widget: TableWidget): HTMLElement {
  const root = el("div", "cc-widget cc-table");
  if (widget.title !== undefined) {
    root.appendChild(el("div", "cc-widget__title", widget.title));
  }

  const table = el("table", "cc-table__grid");
  const thead = el("thead");
  const headRow = el("tr");
  for (const column of widget.data.columns) {
    headRow.appendChild(el("th", "cc-table__head", column.label));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  for (const row of widget.data.rows) {
    const tr = el("tr", "cc-table__row");
    for (const column of widget.data.columns) {
      tr.appendChild(renderCell(row[column.key], column));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  root.appendChild(table);
  host.appendChild(root);
  return root;
}
