import { Check, CircleUserRound, UserRoundX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiData } from "../api/client";
import type { Radiologist } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { EmptyState, LoadingState, Notice, PageHeader } from "../components/ui";

export function StaffPage() {
  const { token } = useAuth();
  const [staff, setStaff] = useState<Radiologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setStaff(await apiData<Radiologist[]>("/staff/radiologists", { token }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load staff.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const toggleMembership = async (radiologist: Radiologist) => {
    if (!token) return;
    const active = !radiologist.active;
    const verb = active ? "reactivate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${verb} ${radiologist.email}?`)) return;
    setWorkingId(radiologist.id);
    setError("");
    setMessage("");
    try {
      await apiData(`/staff/${radiologist.id}/status`, {
        method: "PATCH",
        token,
        body: { active },
      });
      setMessage(`${radiologist.email} was ${active ? "reactivated" : "deactivated"}.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update staff access.");
    } finally {
      setWorkingId("");
    }
  };

  const activeCount = staff.filter((person) => person.active).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Facility administration"
        title="Radiologist access"
        description="Review the radiologist roster and manage active facility memberships."
        action={<span className="count-chip">{activeCount} active</span>}
      />
      {error && <Notice onDismiss={() => setError("")}>{error}</Notice>}
      {message && <Notice tone="success" onDismiss={() => setMessage("")}>{message}</Notice>}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Radiologists</h2>
            <p>Deactivated members lose API access immediately. Existing orders and reports are preserved.</p>
          </div>
        </div>
        {loading ? (
          <LoadingState label="Loading staff roster…" />
        ) : staff.length === 0 ? (
          <EmptyState title="No radiologists in this facility" description="No radiologist memberships were returned by the staff API." />
        ) : (
          <div className="table-scroll">
            <table className="data-table staff-table">
              <thead>
                <tr><th>Radiologist</th><th>Facility role</th><th>Membership</th><th><span className="sr-only">Action</span></th></tr>
              </thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div className="patient-cell">
                        <span className="patient-avatar"><CircleUserRound size={18} /></span>
                        <strong>{person.email}</strong>
                      </div>
                    </td>
                    <td>Radiologist</td>
                    <td>
                      <span className={`membership-state${person.active ? " membership-active" : " membership-inactive"}`}>
                        <span /> {person.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="staff-action-cell">
                      <button
                        className={`button button-small ${person.active ? "button-danger" : "button-secondary"}`}
                        disabled={workingId === person.id}
                        onClick={() => void toggleMembership(person)}
                      >
                        {person.active ? <UserRoundX size={15} /> : <Check size={15} />}
                        {workingId === person.id ? "Updating…" : person.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="admin-note">
        <strong>Access control</strong>
        <span>At least one active facility administrator must remain enabled. This rule is enforced by the backend.</span>
      </div>
    </div>
  );
}
