import {
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, ApiError } from "../api/client";
import type {
  OrderStatus,
  ScanModality,
  WorklistOrder,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  EmptyState,
  LoadingState,
  Notice,
  OrderStatusBadge,
  PageHeader,
  PriorityBadge,
} from "../components/ui";

const statuses: Array<{ value: OrderStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "unassigned", label: "Unassigned" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "reported", label: "Reported" },
  { value: "cancelled", label: "Cancelled" },
];

const modalities: Array<{ value: ScanModality | ""; label: string }> = [
  { value: "", label: "All modalities" },
  { value: "CT", label: "CT" },
  { value: "MRI", label: "MRI" },
  { value: "PET", label: "PET" },
  { value: "XR", label: "X-ray" },
  { value: "US", label: "Ultrasound" },
  { value: "OTHER", label: "Other" },
];

export function WorklistPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<WorklistOrder[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [modality, setModality] = useState<ScanModality | "">("");
  const [nextCursor, setNextCursor] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadPage = useCallback(
    async (cursor = "", append = false, signal?: AbortSignal) => {
      if (!token) return;
      const params = new URLSearchParams({ limit: "25" });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      if (modality) params.set("modality", modality);
      if (cursor) params.set("cursor", cursor);
      const result = await apiRequest<WorklistOrder[]>(
        `/orders?${params.toString()}`,
        { token, signal },
      );
      setOrders((current) =>
        append ? [...current, ...result.data] : result.data,
      );
      setNextCursor(result.response.headers.get("X-Next-Cursor") ?? "");
    },
    [token, query, status, modality],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadPage("", false, controller.signal)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Unable to load the worklist.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadPage, reloadKey]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(queryInput.trim());
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setError("");
    try {
      await loadPage(nextCursor, true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load more orders.",
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const canCreate = user?.role === "front_desk" || user?.role === "facility_admin";

  return (
    <div className="page">
      <PageHeader
        eyebrow="Clinical operations"
        title="Order worklist"
        description="Review, assign, and track imaging studies across your facility."
        action={
          canCreate ? (
            <button
              className="button button-primary"
              onClick={() => navigate("/app/orders/new")}
            >
              <Plus size={17} />
              New order
            </button>
          ) : undefined
        }
      />

      <section className="worklist-toolbar panel">
        <form className="search-form" onSubmit={submitSearch}>
          <Search size={18} />
          <input
            aria-label="Search patients and orders"
            placeholder="Search patient, MRN, or accession"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
          />
          <button className="button button-secondary button-small" type="submit">
            Search
          </button>
        </form>
        <div className="toolbar-filters">
          <SlidersHorizontal size={17} />
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as OrderStatus | "")}
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <label>
            <span className="sr-only">Filter by modality</span>
            <select
              value={modality}
              onChange={(event) => setModality(event.target.value as ScanModality | "")}
            >
              {modalities.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
      </section>

      {error && (
        <Notice onDismiss={() => setError("")}>
          {error}
          <button
            className="text-button notice-retry"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Retry
          </button>
        </Notice>
      )}

      <section className="panel worklist-panel">
        <div className="panel-heading">
          <div>
            <h2>Imaging orders</h2>
            <p>{loading ? "Updating the latest worklist…" : `${orders.length} orders shown`}</p>
          </div>
          <button
            className="icon-button table-sort"
            onClick={() => setReloadKey((key) => key + 1)}
            aria-label="Refresh worklist"
            title="Refresh worklist"
          >
            <ArrowDownUp size={16} />
          </button>
        </div>
        {loading ? (
          <LoadingState label="Loading worklist…" />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="Try adjusting your filters or create a new imaging order."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table worklist-table">
              <thead>
                <tr>
                  <th>Patient / Accession</th>
                  <th>Study</th>
                  <th>Priority</th>
                  <th>Assigned to</th>
                  <th>Status</th>
                  <th><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(({ order, patient }) => (
                  <tr
                    key={order.id}
                    className="clickable-row"
                    onClick={() => navigate(`/app/orders/${order.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") navigate(`/app/orders/${order.id}`);
                    }}
                    tabIndex={0}
                  >
                    <td>
                      <strong>{patient.firstName} {patient.lastName}</strong>
                      <span className="table-subtext">
                        {order.accessionNumber} <span>·</span> MRN {patient.medicalRecordNumber}
                      </span>
                    </td>
                    <td>
                      <span className="study-modality">{order.modality}</span>
                      <span className="table-subtext">{order.procedureName}</span>
                    </td>
                    <td><PriorityBadge priority={order.priority} /></td>
                    <td>
                      {order.assignedRadiologistId ? (
                        <span className="assigned-indicator">
                          <span className="assigned-dot" /> Assigned
                        </span>
                      ) : (
                        <span className="muted-text">Unassigned</span>
                      )}
                    </td>
                    <td><OrderStatusBadge status={order.status} /></td>
                    <td><ChevronRight size={17} className="row-chevron" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor && !loading && (
          <div className="table-footer">
            <button
              className="button button-secondary"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more orders"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
