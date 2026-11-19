import { ArrowLeft, Check, Clock3, FileSignature, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiData, ApiError } from "../api/client";
import type {
  OrderDetail,
  ReportDraft,
  ReportSection,
  ReportTemplate,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  EmptyState,
  LoadingState,
  Notice,
  PdfStatusBadge,
  PageHeader,
} from "../components/ui";

export function ReportEditorPage() {
  const { orderId = "" } = useParams();
  const { token, user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [report, setReport] = useState<ReportDraft | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [content, setContent] = useState<Record<string, string>>({});
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amendmentEditing, setAmendmentEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token || !orderId) return;
    setLoading(true);
    setError("");
    try {
      const [orderResult, templateResult] = await Promise.all([
        apiData<OrderDetail>(`/orders/${orderId}`, { token }),
        apiData<ReportTemplate[]>("/report-templates", { token }),
      ]);
      setOrder(orderResult);
      setTemplates(templateResult);
      try {
        const draft = await apiData<ReportDraft>(`/orders/${orderId}/report`, { token });
        setReport(draft);
        setTemplateId(draft.templateId);
        setContent(draft.draftContent ?? {});
        setAmendmentReason(draft.draftAmendmentReason ?? "");
        setAmendmentEditing(
          draft.latestVersionNumber > 0 && draft.status === "draft",
        );
      } catch (requestError) {
        if (!(requestError instanceof ApiError) || requestError.status !== 404) {
          throw requestError;
        }
        setReport(null);
        setTemplateId(templateResult[0]?.id ?? "");
        setContent({});
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load the report workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const template = useMemo(
    () => templates.find((item) => item.id === (report?.templateId ?? templateId)),
    [templates, report?.templateId, templateId],
  );
  const sections: ReportSection[] = template?.sections ?? [];
  const isSigned = report?.status === "signed";
  const isAmendment = Boolean(report && report.latestVersionNumber > 0);
  const readOnly = isSigned && !amendmentEditing;
  const canEdit = user?.role === "radiologist" || user?.role === "facility_admin";
  const missingRequired = sections.filter(
    (section) => section.required && !content[section.key]?.trim(),
  );

  const startDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !templateId) return;
    setSaving(true);
    setError("");
    try {
      const draft = await apiData<ReportDraft>(`/orders/${orderId}/report`, {
        method: "POST",
        token,
        body: { templateId },
      });
      setReport(draft);
      setContent(draft.draftContent ?? {});
      setMessage("Report draft started.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start a report draft.");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async (contentToSave = content) => {
    if (!token || !report) return false;
    if (missingRequired.length > 0) {
      setError(`Complete required sections: ${missingRequired.map((section) => section.label).join(", ")}.`);
      return false;
    }
    if (isAmendment && !amendmentReason.trim()) {
      setError("Enter the reason for this amendment before saving.");
      return false;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiData(`/reports/${report.id}/draft`, {
        method: "PUT",
        token,
        body: {
          content: contentToSave,
          ...(isAmendment ? { amendmentReason: amendmentReason.trim() } : {}),
        },
      });
      setMessage("Draft saved.");
      await load();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save the draft.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const signReport = async () => {
    if (!token || !report) return;
    if (missingRequired.length > 0) {
      setError(`Complete required sections: ${missingRequired.map((section) => section.label).join(", ")}.`);
      return;
    }
    if (isAmendment && !amendmentReason.trim()) {
      setError("Enter the reason for this amendment before signing.");
      return;
    }
    if (!window.confirm(isAmendment ? "Sign this report amendment? The previous signed version will remain in the history." : "Sign this report? The signed version will be immutable.")) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiData(`/reports/${report.id}/draft`, {
        method: "PUT",
        token,
        body: {
          content,
          ...(isAmendment ? { amendmentReason: amendmentReason.trim() } : {}),
        },
      });
      await apiData(`/reports/${report.id}/${isAmendment ? "amend" : "sign"}`, {
        method: "POST",
        token,
      });
      setMessage("Report signed. PDF generation has been queued.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign the report.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><LoadingState label="Loading report workspace…" /></div>;
  if (!order) {
    return (
      <div className="page">
        <Link className="back-link" to="/app/worklist"><ArrowLeft size={16} /> Back to worklist</Link>
        {error && <Notice>{error}</Notice>}
      </div>
    );
  }
  if (!canEdit) {
    return <div className="page"><Notice>You do not have permission to edit this report.</Notice></div>;
  }

  const { patient } = order;
  return (
    <div className="page report-page">
      <Link className="back-link" to={`/app/orders/${orderId}`}>
        <ArrowLeft size={16} /> Back to order
      </Link>
      <PageHeader
        eyebrow={`Report workspace · ${order.order.accessionNumber}`}
        title={`${patient.firstName} ${patient.lastName}`}
        description={`${order.order.modality} · ${order.order.procedureName} · MRN ${patient.medicalRecordNumber}`}
        action={
          report ? (
            <span className={`report-state${isSigned ? " report-state-signed" : ""}`}>
              {isSigned ? <Check size={15} /> : <Clock3 size={15} />}
              {isSigned ? `Signed · v${report.latestVersionNumber}` : "Draft"}
            </span>
          ) : undefined
        }
      />
      {error && <Notice onDismiss={() => setError("")}>{error}</Notice>}
      {message && <Notice tone="success" onDismiss={() => setMessage("")}>{message}</Notice>}

      {!report ? (
        <section className="panel start-report-panel">
          <div className="workflow-icon"><FileSignature size={21} /></div>
          <div>
            <h2>Start a report</h2>
            <p>Choose the approved report template for this study.</p>
          </div>
          {templates.length === 0 ? (
            <EmptyState title="No templates available" description="Ask a facility administrator to add a report template." />
          ) : (
            <form className="start-report-form" onSubmit={(event) => void startDraft(event)}>
              <label className="field">
                <span>Report template</span>
                <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} required>
                  {templates.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}
                </select>
              </label>
              <button className="button button-primary" disabled={saving}>{saving ? "Starting…" : "Create draft"}</button>
            </form>
          )}
        </section>
      ) : (
        <div className="report-layout">
          <div className="report-editor-column">
            <section className="panel report-patient-banner">
              <div className="patient-avatar patient-avatar-large">
                {patient.firstName.slice(0, 1)}{patient.lastName.slice(0, 1)}
              </div>
              <div>
                <strong>{patient.firstName} {patient.lastName}</strong>
                <span>MRN {patient.medicalRecordNumber}{patient.dateOfBirth ? ` · DOB ${patient.dateOfBirth}` : ""}</span>
              </div>
              <div className="report-study-meta">
                <span>{order.order.modality}</span>
                <span>{order.order.accessionNumber}</span>
              </div>
            </section>

            {isSigned && !amendmentEditing && (
              <Notice tone="info">
                This signed report is read-only. Start an amendment to create a new version while preserving the original.
              </Notice>
            )}
            {isAmendment && amendmentEditing && (
              <label className="field amendment-reason-field">
                <span>Reason for amendment <b>*</b></span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={amendmentReason}
                  onChange={(event) => setAmendmentReason(event.target.value)}
                  placeholder="Explain why this report is being amended"
                  required
                />
              </label>
            )}

            <section className="panel report-form-panel">
              <div className="report-form-heading">
                <div>
                  <p className="eyebrow">{template?.name ?? "Report template"}</p>
                  <h2>{isAmendment ? "Amendment draft" : "Report findings"}</h2>
                </div>
                {isSigned && !amendmentEditing && (
                  <button className="button button-secondary button-small" onClick={() => setAmendmentEditing(true)}>
                    Start amendment
                  </button>
                )}
              </div>
              {sections.map((section) => (
                <label className="field report-section-field" key={section.key}>
                  <span>{section.label}{section.required && <b> *</b>}</span>
                  <textarea
                    rows={section.key === "findings" ? 7 : section.key === "impression" ? 4 : 3}
                    value={content[section.key] ?? ""}
                    onChange={(event) => setContent({ ...content, [section.key]: event.target.value })}
                    placeholder={`Enter ${section.label.toLowerCase()}…`}
                    disabled={readOnly || saving}
                    maxLength={20_000}
                    required={section.required}
                  />
                </label>
              ))}
              {sections.length === 0 && (
                <EmptyState title="Template sections unavailable" description="The template may have been deactivated. Contact an administrator." />
              )}
              {!readOnly && (
                <div className="report-actions">
                  <button className="button button-secondary" disabled={saving} onClick={() => void saveDraft()}>
                    <Save size={16} /> {saving ? "Saving…" : "Save draft"}
                  </button>
                  <button className="button button-primary" disabled={saving || missingRequired.length > 0 || !sections.length} onClick={() => void signReport()}>
                    <FileSignature size={16} /> {saving ? "Working…" : isAmendment ? "Sign amendment" : "Sign report"}
                  </button>
                </div>
              )}
            </section>
          </div>

          <aside className="report-history-column">
            <section className="panel version-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Audit trail</p>
                  <h2>Version history</h2>
                </div>
                <span className="version-count">{report.versions.length}</span>
              </div>
              {report.versions.length === 0 ? (
                <p className="muted-text version-empty">No signed versions yet.</p>
              ) : (
                <ol className="version-list">
                  {report.versions.map((version) => (
                    <li key={version.id}>
                      <span className="version-dot" />
                      <div className="version-copy">
                        <strong>Version {version.versionNumber}</strong>
                        <span>{new Date(version.signedAt).toLocaleString()}</span>
                        {version.amendmentReason && <p>{version.amendmentReason}</p>}
                        <PdfStatusBadge status={version.pdfStatus} />
                        {version.pdfStatus === "ready" && (
                          <Link className="version-pdf-link" to={`/app/reports/${version.id}/pdf`}>View PDF</Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <div className="clinical-note">
              <strong>Before signing</strong>
              <p>Confirm the patient and study details, complete all required sections, and review the final report.</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
