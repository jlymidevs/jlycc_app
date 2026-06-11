// app/tests/e2e/global-setup.ts
// Seeds the minimum data the E2E suite assumes: a region, a branch, and the
// staff login (admin@jly.church / changeme). Idempotent — safe on every run.
// Only ever touches the local docker-compose database pinned in
// playwright.config.ts; it refuses anything else as a guard against prod.
import postgres from "postgres";
import bcrypt from "bcryptjs";

const LOCAL_DB = "postgresql://jly_admin:localdevpassword@localhost:5432/jly";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? LOCAL_DB;
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      "E2E global setup refuses to run against a non-local database."
    );
  }

  const sql = postgres(url, { max: 1 });
  try {
    const [region] = await sql`
      INSERT INTO core.region (code, name, type)
      VALUES ('E2E', 'E2E Region', 'LOCAL_CLUSTER')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING region_id
    `;

    await sql`
      INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
      VALUES ('E2E-MAIN', 'Test Branch', ${region.region_id}, 'LOCAL', 'PH', 'Asia/Manila')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    `;

    const hash = bcrypt.hashSync("changeme", 10);
    await sql`
      INSERT INTO app.users (email, name, password_hash, role)
      VALUES ('admin@jly.church', 'E2E Admin', ${hash}, 'SUPER_ADMIN')
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash, role = 'SUPER_ADMIN', is_active = true
    `;

    const [branch] = await sql`
      SELECT branch_id FROM core.branch WHERE code = 'E2E-MAIN'
    `;

    // Two members — member-detail and list tests assume at least one exists.
    const baselineMembers = [
      ["Baseline", "Alpha"],
      ["Baseline", "Bravo"],
    ];
    for (let i = 0; i < baselineMembers.length; i++) {
      const [first, last] = baselineMembers[i];
      const code = `E2E-BASE-${i + 1}`;
      const [existing] = await sql`
        SELECT member_id FROM membership.member WHERE member_code = ${code}
      `;
      if (!existing) {
        const [p] = await sql`
          INSERT INTO core.person (first_name, last_name)
          VALUES (${first}, ${last})
          RETURNING person_id
        `;
        await sql`
          INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
          VALUES (${p.person_id}, ${branch.branch_id}, ${code}, 'REGULAR_MEMBER', now())
        `;
      }
    }

    // Ministry tree — ministries tests assume a network/ministry/chapter.
    const [network] = await sql`
      INSERT INTO ministries.network (code, name)
      VALUES ('E2E-NET', 'E2E Network')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING network_id
    `;
    const [ministry] = await sql`
      INSERT INTO ministries.ministry (network_id, code, name)
      VALUES (${network.network_id}, 'E2E-MIN', 'E2E Ministry')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING ministry_id
    `;
    await sql`
      INSERT INTO ministries.ministry_chapter (ministry_id, branch_id)
      VALUES (${ministry.ministry_id}, ${branch.branch_id})
      ON CONFLICT (ministry_id, branch_id) DO NOTHING
    `;

    // ISU track — session-creation test selects a track from a dropdown.
    await sql`
      INSERT INTO education.isu_track (code, name, order_index)
      VALUES ('E2E-TRACK', 'E2E Track', 999)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    `;
  } finally {
    await sql.end();
  }
}
