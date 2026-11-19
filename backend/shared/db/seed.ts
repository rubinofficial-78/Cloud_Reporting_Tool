import "dotenv/config";
import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, pool } from "./connection.js";
import {
  facilities,
  facilityMemberships,
  reportTemplates,
  users,
  type ReportTemplateSection,
} from "./schema.js";

interface SeedStaff {
  email: string;
  password: string;
  role: "facility_admin" | "front_desk" | "radiologist";
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set before seeding`);
  }
  return value;
}

async function seed(): Promise<void> {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Demo seeding is allowed only with NODE_ENV=development and ALLOW_DEMO_SEED=true",
    );
  }

  const facilityName = requiredEnv("DEV_FACILITY_NAME");
  const facilityAddress = requiredEnv("DEV_FACILITY_ADDRESS");
  const facilityPhone = requiredEnv("DEV_FACILITY_PHONE");
  const radiologistEmails = requiredEnv("DEV_RADIOLOGIST_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    radiologistEmails.length < 4 ||
    new Set(radiologistEmails).size !== radiologistEmails.length
  ) {
    throw new Error(
      "DEV_RADIOLOGIST_EMAILS must contain at least four unique email addresses",
    );
  }
  const radiologistPassword = requiredEnv("DEV_RADIOLOGIST_PASSWORD");
  const staff: SeedStaff[] = [
    {
      email: requiredEnv("DEV_ADMIN_EMAIL").toLowerCase(),
      password: requiredEnv("DEV_ADMIN_PASSWORD"),
      role: "facility_admin",
    },
    {
      email: requiredEnv("DEV_FRONT_DESK_EMAIL").toLowerCase(),
      password: requiredEnv("DEV_FRONT_DESK_PASSWORD"),
      role: "front_desk",
    },
    ...radiologistEmails.map((email): SeedStaff => ({
      email,
      password: radiologistPassword,
      role: "radiologist",
    })),
  ];

  if (staff.some(({ password }) => password.length < 8)) {
    throw new Error("Demo passwords must be at least 8 characters");
  }

  let [facility] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.name, facilityName))
    .limit(1);
  if (!facility) {
    [facility] = await db
      .insert(facilities)
      .values({
        name: facilityName,
        address: facilityAddress,
        phone: facilityPhone,
      })
      .returning();
  } else {
    [facility] = await db
      .update(facilities)
      .set({
        name: facilityName,
        address: facilityAddress,
        phone: facilityPhone,
      })
      .where(eq(facilities.id, facility.id))
      .returning();
  }
  if (!facility) {
    throw new Error("Demo facility could not be created");
  }

  for (const person of staff) {
    const passwordHash = await hash(person.password, 12);
    const [user] = await db
      .insert(users)
      .values({ email: person.email, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash },
      })
      .returning({ id: users.id });
    if (!user) {
      throw new Error(`Demo account could not be created for ${person.email}`);
    }

    await db
      .insert(facilityMemberships)
      .values({
        facilityId: facility.id,
        userId: user.id,
        role: person.role,
        active: true,
      })
      .onConflictDoUpdate({
        target: [facilityMemberships.facilityId, facilityMemberships.userId],
        set: { role: person.role, active: true },
      });
  }

  const templateSections: ReportTemplateSection[] = [
    { key: "indication", label: "Clinical indication", required: true },
    { key: "technique", label: "Technique", required: true },
    { key: "findings", label: "Findings", required: true },
    { key: "impression", label: "Impression", required: true },
  ];

  await db
    .insert(reportTemplates)
    .values({
      facilityId: facility.id,
      name: "CT Head",
      sections: templateSections,
      createdBy: (
        await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(
            facilityMemberships,
            and(
              eq(facilityMemberships.userId, users.id),
              eq(facilityMemberships.facilityId, facility.id),
              eq(facilityMemberships.role, "facility_admin"),
            ),
          )
          .limit(1)
      )[0]!.id,
    })
    .onConflictDoNothing({
      target: [
        reportTemplates.facilityId,
        reportTemplates.name,
        reportTemplates.version,
      ],
    });

  console.log(`Demo facility ready: ${facility.id}`);
  console.log(
    `Demo staff accounts were loaded from backend/.env (${radiologistEmails.length} radiologists)`,
  );
}

try {
  await seed();
} catch (error) {
  console.error("Demo seed failed", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
