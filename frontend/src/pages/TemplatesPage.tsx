import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiData } from "../api/client";
import type { ReportSection, ReportTemplate } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  EmptyState,
  LoadingState,
  Modal,
  Notice,
  PageHeader,
} from "../components/ui";

const initialSections: ReportSection[] = [
  { key: "clinical_indication", label: "Clinical indication", required: true },
  { key: "technique", label: "Technique", required: true },
  { key: "findings", label: "Findings", required: true },
  { key: "impression", label: "Impression", required: true },
];

function makeKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function TemplatesPage() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sections, setSections] = useState<ReportSection[]>(initialSections);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setTemplates(await apiData<ReportTemplate[]>("/report-templates", { token }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const updateSection = (index: number, patch: Partial<ReportSection>) => {
    setSections((current) => current.map((section, row) =>
      row === index ? { ...section, ...patch } : section,
    ));
  };

  const addSection = () => {
    setSections((current) => [...current, {
      key: `section_${current.length + 1}`,
      label: "",
      required: false,
    }]);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const normalized = sections.map((section) => ({
      ...section,
      key: makeKey(section.key || section.label),
      label: section.label.trim(),
    }));
    const keys = normalized.map((section) => section.key);
    if (keys.some((key) => !key) || new Set(keys).size !== keys.length) {
      setError("Each template section needs a unique label/key.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiData("/report-templates", {
        method: "POST",
        token,
        body: { name: name.trim(), sections: normalized },
      });
      setMessage("Report template created.");
      setShowForm(false);
      setName("");
      setSections(initialSections);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create the template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Facility administration"
        title="Report templates"
        description="Define structured report sections and required fields for radiologists."
        action={
          <button
            className="button button-primary"
            onClick={() => {
              setError("");
              setShowForm(true);
            }}
          >
            <Plus size={17} /> New template
          </button>
        }
      />
      {error && !showForm && <Notice onDismiss={() => setError("")}>{error}</Notice>}
      {message && <Notice tone="success" onDismiss={() => setMessage("")}>{message}</Notice>}
      {loading ? (
        <LoadingState label="Loading templates…" />
      ) : templates.length === 0 ? (
        <section className="panel">
          <EmptyState title="No templates yet" description="Create a report template to standardize the radiology workflow." />
        </section>
      ) : (
        <div className="template-grid">
          {templates.map((template) => (
            <article className="panel template-card" key={template.id}>
              <div className="template-card-icon"><FilePlus2 size={19} /></div>
              <div className="template-card-title">
                <h2>{template.name}</h2>
                <span>Version {template.version}</span>
              </div>
              <p>{template.sections.length} structured sections</p>
              <ul>
                {template.sections.map((section) => (
                  <li key={section.key}>
                    <span>{section.label}</span>
                    {section.required && <span className="required-tag">Required</span>}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title="Create report template" onClose={() => setShowForm(false)} wide>
          <form className="form-stack modal-form" onSubmit={(event) => void submit(event)}>
            {error && <Notice>{error}</Notice>}
            <label className="field">
              <span>Template name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. CT Chest" maxLength={120} required />
            </label>
            <div className="section-builder">
              <div className="section-builder-heading">
                <div><strong>Report sections</strong><span>Section keys are generated from their labels.</span></div>
                <button className="button button-secondary button-small" type="button" onClick={addSection}><Plus size={15} /> Add section</button>
              </div>
              {sections.map((section, index) => (
                <div className="section-builder-row" key={`${index}-${section.key}`}>
                  <label className="field">
                    <span>Section label</span>
                    <input
                      value={section.label}
                      onChange={(event) => updateSection(index, {
                        label: event.target.value,
                        key: makeKey(event.target.value),
                      })}
                      placeholder="e.g. Findings"
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="checkbox-field">
                    <input type="checkbox" checked={section.required} onChange={(event) => updateSection(index, { required: event.target.checked })} />
                    Required
                  </label>
                  <button
                    className="icon-button danger-icon"
                    type="button"
                    disabled={sections.length === 1}
                    onClick={() => setSections((current) => current.filter((_, row) => row !== index))}
                    aria-label={`Remove ${section.label || "section"}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="button button-primary" disabled={saving}>{saving ? "Creating…" : "Create template"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
