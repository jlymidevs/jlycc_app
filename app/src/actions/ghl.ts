"use server";

import { db } from "@/lib/db";
import { person, contactInfo } from "@/schema/core";
import { member } from "@/schema/membership";
import { ghlGetContacts, ghlCreateContact } from "@/lib/ghl";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface GHLSyncResult {
  imported: number;
  skipped: number;
  errors: number;
}

// Pull contacts from GHL and create members that don't exist yet (matched by email)
export async function importFromGHL(): Promise<GHLSyncResult> {
  const result: GHLSyncResult = { imported: 0, skipped: 0, errors: 0 };

  let page = 1;
  let total = Infinity;
  const processed: string[] = [];

  while (processed.length < total) {
    const { contacts, total: t } = await ghlGetContacts(page);
    total = t;
    if (!contacts.length) break;

    for (const c of contacts) {
      try {
        const email = c.email?.toLowerCase().trim();
        if (!email) { result.skipped++; continue; }

        // Check if already exists by email
        const [existing] = await db
          .select({ personId: contactInfo.personId })
          .from(contactInfo)
          .where(and(eq(contactInfo.type, "EMAIL"), eq(contactInfo.value, email)))
          .limit(1);

        if (existing) {
          // Update ghl_contact_id if missing
          await db
            .update(person)
            .set({ ghlContactId: c.id })
            .where(
              and(eq(person.personId, existing.personId))
            );
          result.skipped++;
          continue;
        }

        // Get default branch
        const [branch] = await db.execute<{ branch_id: number }>(
          `SELECT branch_id FROM core.branch LIMIT 1`
        );
        const branchId = branch?.branch_id ?? 1;

        // Create person
        const [newPerson] = await db
          .insert(person)
          .values({
            firstName: c.firstName ?? "Unknown",
            lastName: c.lastName ?? "Contact",
            ghlContactId: c.id,
          })
          .returning({ personId: person.personId });

        if (email) {
          await db.insert(contactInfo).values({
            personId: newPerson.personId,
            type: "EMAIL",
            value: email,
            isPrimary: true,
          });
        }
        if (c.phone) {
          await db.insert(contactInfo).values({
            personId: newPerson.personId,
            type: "MOBILE",
            value: c.phone,
            isPrimary: true,
          });
        }

        // Create member record
        await db.insert(member).values({
          personId: newPerson.personId,
          branchId,
          memberCode: `GHL-${c.id.slice(0, 8)}`,
          currentStage: "CONNECT",
          joinedAt: new Date(),
        });

        processed.push(c.id);
        result.imported++;
      } catch {
        result.errors++;
      }
    }
    page++;
    if (contacts.length < 100) break;
  }

  revalidatePath("/members");
  return result;
}

// Push all members without ghl_contact_id to GHL
export async function pushMembersToGHL(): Promise<GHLSyncResult> {
  const result: GHLSyncResult = { imported: 0, skipped: 0, errors: 0 };

  const unsynced = await db
    .select({
      personId: person.personId,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(person)
    .where(eq(person.ghlContactId, null as unknown as string));

  for (const p of unsynced) {
    try {
      // Get email + mobile
      const contacts = await db
        .select({ type: contactInfo.type, value: contactInfo.value })
        .from(contactInfo)
        .where(and(eq(contactInfo.personId, p.personId), eq(contactInfo.isPrimary, true)));

      const email = contacts.find((c) => c.type === "EMAIL")?.value;
      const phone = contacts.find((c) => c.type === "MOBILE")?.value;

      const ghlId = await ghlCreateContact({
        firstName: p.firstName,
        lastName: p.lastName,
        email,
        phone,
        tags: ["jlycc-member"],
      });

      if (ghlId) {
        await db
          .update(person)
          .set({ ghlContactId: ghlId })
          .where(eq(person.personId, p.personId));
        result.imported++;
      } else {
        result.errors++;
      }
    } catch {
      result.errors++;
    }
  }

  revalidatePath("/members");
  return result;
}
