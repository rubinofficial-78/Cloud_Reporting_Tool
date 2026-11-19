import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clipboard,
  FileText,
  Link2,
  Play,
  RefreshCw,
  RotateCcw,
  Share2,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiData, ApiError } from "../api/client";
import type {
  OrderDetail,
  Radiologist,
  ReportOverview,
  ShareLink,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  LoadingState,
  Notice,
  OrderStatusBadge,
  PageHeader,
  PdfStatusBadge,
  PriorityBadge,
} from "../components/ui";

export function OrderDetailPage() {
  const { orderId = "" } = useParams();
  const { token, user } = useAuth();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [radiologists, setRadiologists] = useState<Radiologist[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canManageOrders = user?.role === "front_desk" || user?.role === "facility_admin";
  const canWriteReports = user?.role === "radiologist" || user?.role === "facility_admin";
  const activeRadiologists = useMemo(
    () => radiologists.filter((radiologist) => radiologist.active),
    [radiologists],
  );

  const load = useCallback(async () => {
    if (!token || !orderId) return;
    setLoading(true);
    setError("");
    try {
      const loaded = await apiData<OrderDetail>(`/orders/${orderId}`, { token });
      setDetail(loaded);
      setAssigneeId(loaded.order.assignedRadiologistId ?? "");
      try {
        const status = await apiData<ReportOverview>(
          `/orders/${orderId}/report/status`,
          { token },
        );
        setOverview(status);
      } catch (requestError) {
        if (!(requestError instanceof ApiError) || requestError.status !== 404) {
          throw requestError;
        }
        setOverview(null);
      }
      if (canManageOrders) {
        setRadiologists(await apiData<Radiologist[]>("/staff/radiologists", { token }));
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load this order.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, orderId, canManageOrders]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateOrder = async (
    path: string,
    method: "POST" | "PATCH",
    body?: unknown,
    successMessage = "Order updated.",
  ) => {
    if (!token) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await apiData(path, { method, token, body });
      setMessage(successMessage);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update order.");
    } finally {
      setWorking(false);
    }
  };

  const createShareLink = async () => {
    const versionId = overview?.latestVersion?.id;
    if (!token || !versionId) return;
    setWorking(true);
    setError("");
    try {
      const link = await apiData<ShareLink>(
        `/report-versions/${versionId}/share-links`,
        { method: "POST", token, body: { expiresInHours: 72 } },
      );
      setShareLink(link);
      setMessage("A private patient link is ready to copy.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create the patient link.");
    } finally {
      setWorking(false);
    }
  };

  const revokeLink = async () => {
    if (!token || !shareLink) return;
    setWorking(true);
    try {
      await apiData(`/share-links/${shareLink.id}`, { method: "DELETE", token });
      setShareLink(null);
      setMessage("The patient link has been revoked.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to revoke the link.");
    } finally {
      setWorking(false);
    }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink.url);
    setMessage("Patient link copied to clipboard.");
  };

  if (loading) return <div className="page"><LoadingState label="Loading order details…" /></div>;
  if (!detail) {
    return (
      <div className="page">
        <Link className="back-link" to="/app/worklist"><ArrowLeft size={16} /> Back to worklist</Link>
        {error && <Notice>{error}</Notice>}
      </div>
    );
  }

  const { order, patient } = detail;
  const latestVersion = overview?.latestVersion;
  const canStart = user?.role === "radiologist" || user?.role === "facility_admin";

  return (
    <div className="page">
      <Link className="back-link" to="/app/worklist">
        <ArrowLeft size={16} /> Back to worklist
      </Link>
      <PageHeader
        eyebrow={`Accession ${order.accessionNumber}`}
        title={`${patient.firstName} ${patient.lastName}`}
        description={`MRN ${patient.medicalRecordNumber}${patient.dateOfBirth ? ` · DOB ${patient.dateOfBirth}` : ""}`}
        action={<OrderStatusBadge status={order.status} />}
      />
      {error && <Notice onDismiss={() => setError("")}>{error}</Notice>}
      {message && <Notice tone="success" onDismiss={() => setMessage("")}>{message}</Notice>}

      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel study-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Study details</p>
                <h2>{order.procedureName}</h2>
              </div>
              <span className="modality-tile">{order.modality}</span>
            </div>
            <div className="study-facts">
              <div><span>Priority</span><PriorityBadge priority={order.priority} /></div>
              <div><span>Created</span><strong>{new Date(order.createdAt).toLocaleString()}</strong></div>
              <div><span>Accession</span><strong className="mono-text">{order.accessionNumber}</strong></div>
            </div>
          </section>

          <section className="panel workflow-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Workflow</p>
                <h2>Report and delivery</h2>
              </div>
              <button className="icon-button" onClick={() => void load()} aria-label="Refresh order">
                <RefreshCw size={16} />
              </button>
            </div>
            {!overview ? (
              <div className="workflow-empty">
                <div className="workflow-icon"><FileText size={20} /></div>
                <div>
                  <strong>No report draft yet</strong>
                  <p>{order.status === "in_progress" ? "The radiologist can start a report using an available template." : "A report can be started after the assigned radiologist begins the study."}</p>
                </div>
              </div>
            ) : (
              <div className="workflow-empty">
                <div className={`workflow-icon${overview.report.status === "signed" ? " workflow-icon-done" : ""}`}>
                  {overview.report.status === "signed" ? <Check size={20} /> : <FileText size={20} />}
                </div>
                <div className="workflow-report-copy">
                  <strong>{overview.report.status === "signed" ? `Signed report · Version ${overview.report.latestVersionNumber}` : "Report draft in progress"}</strong>
                  <p>{latestVersion ? `Signed ${new Date(latestVersion.signedAt).toLocaleString()}` : "The report has not been signed yet."}</p>
                  {latestVersion && <PdfStatusBadge status={latestVersion.pdfStatus} />}
                </div>
                {canWriteReports && (
                  <Link className="button button-secondary button-small" to={`/app/orders/${order.id}/report`}>
                    Open report <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
            )}

            <div className="workflow-actions">
              {canStart && order.status === "assigned" && (
                <button
                  className="button button-primary"
                  disabled={working}
                  onClick={() => void updateOrder(`/orders/${order.id}/start`, "POST", undefined, "Study started.")}
                >
                  <Play size={16} /> Start study
                </button>
              )}
              {canWriteReports && order.status === "in_progress" && (
                <Link className="button button-primary" to={`/app/orders/${order.id}/report`}>
                  <FileText size={16} /> {overview ? "Open report" : "Start report"}
                </Link>
              )}
              {latestVersion?.pdfStatus === "ready" && (
                <Link className="button button-secondary" to={`/app/reports/${latestVersion.id}/pdf`}>
                  <FileText size={16} /> View PDF
                </Link>
              )}
            </div>
          </section>

          {shareLink && (
            <section className="panel share-link-panel">
              <div className="share-link-heading">
                <span className="share-icon"><Link2 size={18} /></span>
                <div>
                  <h2>Patient access link</h2>
                  <p>Expires {new Date(shareLink.expiresAt).toLocaleString()}</p>
                </div>
                <button className="text-button text-danger" onClick={() => void revokeLink()} disabled={working}>
                  Revoke
                </button>
              </div>
              <div className="share-url-row">
                <input readOnly value={shareLink.url} aria-label="Patient report link" />
                <button className="button button-secondary button-small" onClick={() => void copyLink()}>
                  <Clipboard size={15} /> Copy
                </button>
              </div>
              <p className="helper-text">This link grants access to this report only. Share it through an approved channel.</p>
            </section>
          )}
        </div>

        <aside className="detail-side">
          {canManageOrders && (
            <section className="panel side-panel">
              <p className="eyebrow">Assignment</p>
              <h2>Radiologist</h2>
              {activeRadiologists.length === 0 ? (
                <Notice tone="info">No active radiologists are available to assign.</Notice>
              ) : (
                <div className="form-stack">
                  <label className="field">
                    <span>Assign to</span>
                    <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                      <option value="">Select a radiologist</option>
                      {activeRadiologists.map((radiologist) => (
                        <option key={radiologist.id} value={radiologist.id}>{radiologist.email}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button button-secondary button-full"
                    disabled={working || !assigneeId || assigneeId === order.assignedRadiologistId}
                    onClick={() => void updateOrder(
                      `/orders/${order.id}/assignment`,
                      "PATCH",
                      { radiologistId: assigneeId },
                      "Radiologist assigned.",
                    )}
                  >
                    <UserRoundCheck size={16} /> Save assignment
                  </button>
                </div>
              )}
            </section>
          )}

          {canManageOrders && latestVersion?.pdfStatus === "ready" && !shareLink && (
            <section className="panel side-panel share-card">
              <div className="share-card-mark"><Share2 size={18} /></div>
              <p className="eyebrow">Patient delivery</p>
              <h2>Share the signed report</h2>
              <p>Create a private link that expires in 72 hours. The patient won’t need a staff account.</p>
              <button className="button button-primary button-full" disabled={working} onClick={() => void createShareLink()}>
                <Link2 size={16} /> Create patient link
              </button>
            </section>
          )}

          {canManageOrders && (order.status === "unassigned" || order.status === "assigned") && (
            <button
              className="button button-quiet button-full cancel-order"
              disabled={working}
              onClick={() => {
                if (window.confirm("Cancel this unstarted order?")) {
                  void updateOrder(`/orders/${order.id}/cancel`, "POST", undefined, "Order cancelled.");
                }
              }}
            >
              <XCircle size={16} /> Cancel order
            </button>
          )}
          {user?.role === "radiologist" && order.assignedRadiologistId !== user.id && (
            <Notice tone="info">This order is not assigned to your account.</Notice>
          )}
          {overview && overview.report.latestVersionNumber > 0 && !latestVersion && (
            <Notice tone="info">The latest signed version is not available yet.</Notice>
          )}
          {overview?.report.status === "signed" && latestVersion?.pdfStatus !== "ready" && (
            <button className="text-button refresh-pdf" onClick={() => void load()}>
              <RotateCcw size={14} /> Refresh PDF status
            </button>
          )}
          {latestVersion?.pdfStatus === "failed" && (
            <Notice>PDF generation failed. Contact your administrator before sharing this report.</Notice>
          )}
          {latestVersion?.pdfStatus === "ready" && canManageOrders && !shareLink && (
            <p className="muted-caption">A patient link can be created once the PDF is ready.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
