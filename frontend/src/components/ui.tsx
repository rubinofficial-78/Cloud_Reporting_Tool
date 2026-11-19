import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { OrderPriority, OrderStatus, PdfStatus } from "../api/types";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

export function Notice({
  children,
  tone = "error",
  onDismiss,
}: {
  children: ReactNode;
  tone?: "error" | "success" | "info";
  onDismiss?: () => void;
}) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span>{children}</span>
      {onDismiss && (
        <button className="icon-button notice-dismiss" onClick={onDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-mark">5C</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className={`modal-panel${wide ? " modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const labels: Record<OrderStatus, string> = {
    unassigned: "Unassigned",
    assigned: "Assigned",
    in_progress: "In progress",
    reported: "Reported",
    cancelled: "Cancelled",
  };
  return <span className={`status-badge status-${status}`}>{labels[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  return (
    <span className={`priority-badge priority-${priority}`}>
      {priority === "stat" ? "STAT" : priority}
    </span>
  );
}

export function PdfStatusBadge({ status }: { status: PdfStatus }) {
  const labels: Record<PdfStatus, string> = {
    pending: "PDF queued",
    processing: "PDF generating",
    ready: "PDF ready",
    failed: "PDF failed",
  };
  return <span className={`status-badge pdf-${status}`}>{labels[status]}</span>;
}
