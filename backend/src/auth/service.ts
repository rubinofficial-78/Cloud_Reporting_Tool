import { compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { HttpError } from "../../shared/middleware/http_error.js";
import type { StaffRole } from "../../shared/middleware/authentication.js";
import * as authRepository from "../../shared/repository/auth.repository.js";
import { durationSeconds } from "../../shared/duration.js";

interface LoginInput {
  email: string;
  password: string;
  facilityId: string;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters");
  }
  return secret;
}

export async function login(input: LoginInput) {
  const membership = await authRepository.findStaffMembership(
    input.email.toLowerCase(),
    input.facilityId,
  );
  const passwordMatches = membership?.active
    ? await compare(input.password, membership.passwordHash)
    : false;

  if (!membership || !passwordMatches) {
    throw new HttpError(401, "Invalid email, password, or facility");
  }

  const tokenTtl = process.env.JWT_ACCESS_TTL ?? "15m";
  const token = jwt.sign(
    {
      facilityId: membership.facilityId,
      role: membership.role satisfies StaffRole,
    },
    jwtSecret(),
    {
      algorithm: "HS256",
      audience: "staff-api",
      subject: membership.userId,
      expiresIn: durationSeconds(tokenTtl, "JWT_ACCESS_TTL", 24 * 60 * 60),
    },
  );

  await authRepository.recordLogin(membership.userId, membership.facilityId);
  return {
    accessToken: token,
    tokenType: "Bearer",
    expiresIn: tokenTtl,
    user: {
      id: membership.userId,
      email: membership.email,
      facilityId: membership.facilityId,
      facilityName: membership.facilityName,
      role: membership.role,
    },
  };
}
