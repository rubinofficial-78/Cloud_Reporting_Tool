import type { Request, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { failureResponse } from "../response_format.js";

export interface PatientAccess {
  facilityId: string;
  shareLinkId: string;
  versionId: string;
}

declare global {
  namespace Express {
    interface Request {
      patientAccess?: PatientAccess;
    }
  }
}

function isPatientAccessPayload(
  payload: string | JwtPayload,
): payload is JwtPayload & PatientAccess {
  return (
    typeof payload !== "string" &&
    typeof payload.facilityId === "string" &&
    typeof payload.shareLinkId === "string" &&
    typeof payload.versionId === "string"
  );
}

export const authenticatePatientAccess: RequestHandler = (
  request,
  response,
  next,
) => {
  const token = request.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    next(new Error("JWT_SECRET must be configured with at least 32 characters"));
    return;
  }
  if (!token) {
    response.status(401).json(failureResponse("Patient access token required"));
    return;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      audience: "patient-report",
    });
    if (!isPatientAccessPayload(payload)) {
      response.status(401).json(failureResponse("Invalid patient access token"));
      return;
    }
    request.patientAccess = {
      facilityId: payload.facilityId,
      shareLinkId: payload.shareLinkId,
      versionId: payload.versionId,
    };
    next();
  } catch {
    response
      .status(401)
      .json(failureResponse("Invalid or expired patient access token"));
  }
};

export function getPatientAccess(request: Request): PatientAccess {
  if (!request.patientAccess) {
    throw new Error("Patient access middleware was not applied");
  }
  return request.patientAccess;
}
