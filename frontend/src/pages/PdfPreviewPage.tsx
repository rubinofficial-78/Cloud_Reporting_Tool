import { ArrowDownToLine, ArrowLeft, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiBlob, apiData, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LoadingState, Notice, PageHeader } from "../components/ui";

export function PdfPreviewPage() {
  const { versionId = "" } = useParams();
  const { token } = useAuth();
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (!token || !versionId) return;
    void apiBlob(`/report-versions/${versionId}/pdf`, token)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "Unable to load the report PDF.",
          );
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, versionId]);

  return (
    <div className="page pdf-page">
      <Link className="back-link" to="/app/worklist"><ArrowLeft size={16} /> Back to worklist</Link>
      <PageHeader
        eyebrow="Signed report"
        title="PDF preview"
        description="This private report is delivered through your authenticated staff session."
        action={pdfUrl ? (
          <a className="button button-primary" href={pdfUrl} download="radiology-report.pdf">
            <ArrowDownToLine size={16} /> Download PDF
          </a>
        ) : undefined}
      />
      {error && <Notice>{error}</Notice>}
      {!pdfUrl && !error ? (
        <LoadingState label="Loading private PDF…" />
      ) : pdfUrl ? (
        <section className="pdf-frame panel">
          <iframe title="Radiology report PDF" src={pdfUrl} />
        </section>
      ) : (
        <div className="panel pdf-error-panel">
          <FileText size={22} />
          <span>The PDF may still be generating or is no longer available.</span>
        </div>
      )}
    </div>
  );
}

export function PatientReportPage() {
  const navigate = useNavigate();
  const [shareToken] = useState(() => {
    const hashQuery = window.location.hash.split("?")[1] ?? "";
    return new URLSearchParams(hashQuery).get("token") ?? "";
  });
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (!shareToken) {
      setError("This report link is missing or invalid.");
      setLoading(false);
      return;
    }

    navigate("/patient-report", { replace: true });
    const loadPdf = async () => {
      try {
        const access = await apiData<{ accessToken: string; versionId: string }>(
          "/public/report-access/exchange",
          { method: "POST", body: { token: shareToken } },
        );
        const blob = await apiBlob(
          `/public/report-access/reports/${access.versionId}/pdf`,
          access.accessToken,
        );
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setPdfUrl(objectUrl);
        }
      } catch {
        if (active) setError("This report link is invalid, expired, or has been revoked.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPdf();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [navigate, shareToken]);

  return (
    <main className="patient-report-page">
      <header className="patient-report-header">
        <div className="brand-lockup">
          <img src="/assets/5c-networks-logo.png" alt="" />
          <span><strong>5C Networks</strong><small>Secure report delivery</small></span>
        </div>
        <span className="secure-label">Private report</span>
      </header>
      <section className="patient-report-content">
        <PageHeader
          eyebrow="Patient access"
          title="Your radiology report"
          description="This secure link provides access to the report shared by your imaging centre."
          action={pdfUrl ? (
            <a className="button button-primary" href={pdfUrl} download="radiology-report.pdf">
              <ArrowDownToLine size={16} /> Download
            </a>
          ) : undefined}
        />
        {loading && <LoadingState label="Verifying your secure link…" />}
        {error && <Notice>{error}</Notice>}
        {pdfUrl && (
          <section className="pdf-frame patient-pdf-frame panel">
            <iframe title="Your radiology report" src={pdfUrl} />
          </section>
        )}
        <p className="patient-report-footnote">
          Keep this link private. If you have questions about your report, contact your imaging centre.
        </p>
      </section>
    </main>
  );
}
