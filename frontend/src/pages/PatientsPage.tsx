import { Archive, Edit3, Plus, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest, ApiError } from "../api/client";
import type { Patient } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  EmptyState,
  LoadingState,
  Modal,
  Notice,
  PageHeader,
} from "../components/ui";

type PatientFormValue = {
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

const emptyForm: PatientFormValue = {
  medicalRecordNumber: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
};

export function PatientsPage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [cursor, setCursor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientFormValue>(emptyForm);
  const [query, setQuery] = useState("");

  const load = useCallback(async (nextCursor = "", append = false) => {
    if (!token) return;
    const params = new URLSearchParams({ limit: "50" });
    if (nextCursor) params.set("cursor", nextCursor);
    const result = await apiRequest<Patient[]>(`/patients?${params.toString()}`, { token });
    setPatients((current) => append ? [...current, ...result.data] : result.data);
    setCursor(result.response.headers.get("X-Next-Cursor") ?? "");
  }, [token]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load()
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load patients.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [load]);

  const visiblePatients = patients.filter((patient) =>
    `${patient.firstName} ${patient.lastName} ${patient.medicalRecordNumber}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEdit = (patient: Patient) => {
    setEditing(patient);
    setForm({
      medicalRecordNumber: patient.medicalRecordNumber,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth ?? "",
    });
    setError("");
    setShowForm(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
    };
    try {
      if (editing) {
        await apiRequest(`/patients/${editing.id}`, { method: "PATCH", token, body });
        setSuccess("Patient details updated.");
      } else {
        await apiRequest("/patients", {
          method: "POST",
          token,
          body: {
            ...body,
            medicalRecordNumber: form.medicalRecordNumber.trim(),
          },
        });
        setSuccess("Patient record created.");
      }
      setShowForm(false);
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to save patient details.",
      );
    } finally {
      setSaving(false);
    }
  };

  const archivePatient = async (patient: Patient) => {
    if (!token || !window.confirm(`Archive ${patient.firstName} ${patient.lastName}?`)) return;
    setError("");
    try {
      await apiRequest(`/patients/${patient.id}`, { method: "DELETE", token });
      setSuccess("Patient record archived.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to archive patient.");
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Patient records"
        title="Patients"
        description="Maintain facility-scoped patient records and medical record numbers."
        action={
          <button className="button button-primary" onClick={openCreate}>
            <Plus size={17} />
            Add patient
          </button>
        }
      />
      {error && <Notice onDismiss={() => setError("")}>{error}</Notice>}
      {success && <Notice tone="success" onDismiss={() => setSuccess("")}>{success}</Notice>}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Patient directory</h2>
            <p>{patients.length} records loaded</p>
          </div>
          <label className="inline-search">
            <Search size={17} />
            <input
              placeholder="Filter loaded patients"
              aria-label="Filter loaded patients"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <LoadingState label="Loading patient records…" />
        ) : visiblePatients.length === 0 ? (
          <EmptyState
            title="No patients found"
            description={query ? "Try another name or MRN." : "Create a patient record to start an imaging order."}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medical record number</th>
                  <th>Date of birth</th>
                  <th>Created</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visiblePatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <div className="patient-cell">
                        <span className="patient-avatar">
                          {patient.firstName.slice(0, 1)}{patient.lastName.slice(0, 1)}
                        </span>
                        <strong>{patient.firstName} {patient.lastName}</strong>
                      </div>
                    </td>
                    <td><span className="mono-text">{patient.medicalRecordNumber}</span></td>
                    <td>{patient.dateOfBirth || <span className="muted-text">Not provided</span>}</td>
                    <td>{new Date(patient.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" onClick={() => openEdit(patient)} title="Edit patient" aria-label="Edit patient">
                          <Edit3 size={16} />
                        </button>
                        <button className="icon-button danger-icon" onClick={() => void archivePatient(patient)} title="Archive patient" aria-label="Archive patient">
                          <Archive size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {cursor && !loading && (
          <div className="table-footer">
            <button
              className="button button-secondary"
              onClick={() => {
                setLoading(true);
                void load(cursor, true)
                  .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Unable to load more patients."))
                  .finally(() => setLoading(false));
              }}
            >
              Load more patients
            </button>
          </div>
        )}
      </section>

      {showForm && (
        <Modal
          title={editing ? "Edit patient" : "Add patient"}
          onClose={() => setShowForm(false)}
        >
          <form className="form-stack modal-form" onSubmit={submit}>
            {error && <Notice>{error}</Notice>}
            <label className="field">
              <span>Medical record number</span>
              <input
                value={form.medicalRecordNumber}
                onChange={(event) => setForm({ ...form, medicalRecordNumber: event.target.value })}
                required
                disabled={Boolean(editing)}
                maxLength={64}
              />
            </label>
            <div className="form-row">
              <label className="field">
                <span>First name</span>
                <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required maxLength={100} />
              </label>
              <label className="field">
                <span>Last name</span>
                <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required maxLength={100} />
              </label>
            </div>
            <label className="field">
              <span>Date of birth <small>Optional</small></span>
              <input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
            </label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="button button-primary" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create patient"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <span className="sr-only"><UsersRound size={1} /></span>
    </div>
  );
}
