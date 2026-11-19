import type { Request, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { failureResponse } from "../response_format.js";
import * as authRepository from "../repository/auth.repository.js";
import { HttpError } from "./http_error.js";

export type StaffRole = "front_desk" | "radiologist" | "facility_admin";

export interface AuthenticatedUser {
  userId: string;
  facilityId: string;
  role: StaffRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function isStaffRole(role: unknown): role is StaffRole {
  return (
    role === "front_desk" ||
    role === "radiologist" ||
    role === "facility_admin"
  );
}

function isAuthenticatedPayload(
  payload: string | JwtPayload,
): payload is JwtPayload & { sub: string; facilityId: string; role: StaffRole } {
  return (
    typeof payload !== "string" &&
    typeof payload.sub === "string" &&
    typeof payload.facilityId === "string" &&
    isStaffRole(payload.role)
  );
}

export const authenticate: RequestHandler = async (
  request,
  response,
  next,
) => {
  const authorization = request.header("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    next(new Error("JWT_SECRET must be configured with at least 32 characters"));
    return;
  }
  if (!token) {
    response.status(401).json(failureResponse("Authentication required"));
    return;
  }

  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      audience: "staff-api",
    });
  } catch {
    response.status(401).json(failureResponse("Invalid or expired access token"));
    return;
  }

  if (!isAuthenticatedPayload(payload)) {
    response.status(401).json(failureResponse("Invalid access token"));
    return;
  }
  try {
    const active = await authRepository.hasActiveMembership(
      payload.sub,
      payload.facilityId,
      payload.role,
    );
    if (!active) {
      response.status(401).json(failureResponse("Staff access is no longer active"));
      return;
    }
    request.user = {
      userId: payload.sub,
      facilityId: payload.facilityId,
      role: payload.role,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export function authorizeRoles(...allowedRoles: StaffRole[]): RequestHandler {
  return (request, response, next) => {
    const user = request.user;
    if (!user) {
      response.status(401).json(failureResponse("Authentication required"));
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      response.status(403).json(failureResponse("Insufficient permissions"));
      return;
    }
    next();
  };
}

export function getAuthenticatedUser(request: Request): AuthenticatedUser {
  if (!request.user) {
    throw new HttpError(401, "Authentication required");
  }
  return request.user;
}
