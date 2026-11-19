import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiData, ApiError } from "../api/client";
import type { OrderPriority, Patient, ScanModality } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Notice, PageHeader } from "../components/ui";

export function NewOrderPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [modality, setModality] = useState<ScanModality>("CT");
  const [procedureName, setProcedureName] = useState("");
  const [priority, setPriority] = useState<OrderPriority>("routine");
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    void apiData<Patient[]>("/patients?limit=100", { token })
      .then((rows) => {
        setPatients(rows);
        setPatientId(rows[0]?.id ?? "");
      })
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load patients.");
      })
      .finally(() => setLoadingPatients(false));
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const order = await apiData<{ id: string }>("/orders", {
        method: "POST",
        token,
        body: { patientId, modality, procedureName: procedureName.trim(), priority },
      });
      navigate(`/app/orders/${order.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to create the imaging order.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeader
        eyebrow="Order intake"
        title="Create an imaging order"
        description="Capture the requested study, then assign it to a radiologist."
      />
      <section className="panel form-panel">
        {error && <Notice>{error}</Notice>}
        {patients.length === 0 && !loadingPatients ? (
          <div className="empty-state compact-empty">
            <div className="empty-state-mark"><Plus size={20} /></div>
            <h3>Add a patient first</h3>
            <p>Orders must be linked to a patient record in this facility.</p>
            <Link className="button button-primary" to="/app/patients">Go to patients</Link>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submit}>
            <label className="field">
              <span>Patient</span>
              <select value={patientId} onChange={(event) => setPatientId(event.target.value)} required disabled={loadingPatients}>
                {loadingPatients && <option value="">Loading patients…</option>}
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName} · MRN {patient.medicalRecordNumber}
                  </option>
                ))}
              </select>
              <small>Can’t find the patient? <Link to="/app/patients">Add a new patient</Link>.</small>
            </label>
            <div className="form-row">
              <label className="field">
                <span>Modality</span>
                <select value={modality} onChange={(event) => setModality(event.target.value as ScanModality)}>
                  <option value="CT">CT</option>
                  <option value="MRI">MRI</option>
                  <option value="PET">PET</option>
                  <option value="XR">X-ray</option>
                  <option value="US">Ultrasound</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">STAT</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Procedure / study name</span>
              <input
                value={procedureName}
                onChange={(event) => setProcedureName(event.target.value)}
                placeholder="e.g. CT Head without contrast"
                required
                maxLength={200}
              />
            </label>
            <div className="form-panel-note">
              <span className="form-note-number">01</span>
              <span>After creation, you can assign this order to an active radiologist from the order details.</span>
            </div>
            <div className="form-actions">
              <button type="button" className="button button-secondary" onClick={() => navigate(-1)}>
                <ArrowLeft size={16} /> Back
              </button>
              <button className="button button-primary" disabled={saving || loadingPatients || !patientId}>
                {saving ? "Creating…" : "Create order"}
                {!saving && <ArrowRight size={16} />}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
