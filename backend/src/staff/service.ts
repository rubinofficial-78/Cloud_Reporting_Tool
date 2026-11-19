import { HttpError } from "../../shared/middleware/http_error.js";
import * as staffRepository from "../../shared/repository/staff.repository.js";

export async function listRadiologists(facilityId: string) {
  return staffRepository.listRadiologists(facilityId);
}

export async function setMembershipActive(
  facilityId: string,
  actorId: string,
  userId: string,
  active: boolean,
) {
  if (actorId === userId && !active) {
    throw new HttpError(400, "You cannot deactivate your own facility membership");
  }
  const membership = await staffRepository.setMembershipActive(
    facilityId,
    userId,
    active,
    actorId,
  );
  if (!membership) {
    throw new HttpError(404, "Staff membership not found");
  }
  return { userId: membership.userId, role: membership.role, active: membership.active };
}
