// One-off prod data audit: networks → ministries → chapters → members/heads.
import fs from "node:fs";
import postgres from "postgres";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=["']?([^"'\r\n]+)/m)?.[1];
if (!url) throw new Error("DATABASE_URL not found in .env");
console.log("DB host:", new URL(url).host, "\n");
const sql = postgres(url, { ssl: "require", max: 1 });

const networks = await sql`
  select n.network_id, n.code, n.name, n.description,
         count(distinct m.ministry_id) as ministries
  from ministries.network n
  left join ministries.ministry m on m.network_id = n.network_id
  group by n.network_id order by n.name`;
console.log("=== NETWORKS ===");
for (const n of networks)
  console.log(`${n.name} [${n.code}] — ${n.ministries} ministries${n.description ? " — " + n.description : ""}`);

const ministries = await sql`
  select net.name as network, m.name, m.code, m.target_demographic,
         count(distinct c.chapter_id) as chapters,
         count(distinct mm.membership_id) filter (where mm.ended_at is null) as active_members,
         count(distinct mm.membership_id) filter (where mm.is_leader and mm.ended_at is null) as leaders
  from ministries.ministry m
  join ministries.network net on net.network_id = m.network_id
  left join ministries.ministry_chapter c on c.ministry_id = m.ministry_id
  left join ministries.ministry_membership mm on mm.chapter_id = c.chapter_id
  group by net.name, m.ministry_id order by net.name, m.name`;
console.log("\n=== MINISTRIES ===");
for (const m of ministries)
  console.log(`[${m.network}] ${m.name} (${m.code}) — chapters:${m.chapters} active members:${m.active_members} leaders:${m.leaders}${m.target_demographic ? " — " + m.target_demographic : ""}`);

const heads = await sql`
  select m.name as ministry, mm.leader_role,
         p.first_name || ' ' || p.last_name as person
  from ministries.ministry_membership mm
  join ministries.ministry_chapter c on c.chapter_id = mm.chapter_id
  join ministries.ministry m on m.ministry_id = c.ministry_id
  join membership.member mem on mem.member_id = mm.member_id
  join core.person p on p.person_id = mem.person_id
  where mm.is_leader and mm.ended_at is null
  order by m.name`;
console.log("\n=== LEADERS ===");
if (!heads.length) console.log("(none assigned)");
for (const h of heads) console.log(`${h.ministry}: ${h.person} (${h.leader_role ?? "leader"})`);

const jr = await sql`
  select status, count(*) from ministries.join_request group by status`;
console.log("\n=== JOIN REQUESTS ===");
if (!jr.length) console.log("(none)");
for (const r of jr) console.log(`${r.status}: ${r.count}`);

const chapters = await sql`
  select m.name as ministry, b.name as branch, c.status
  from ministries.ministry_chapter c
  join ministries.ministry m on m.ministry_id = c.ministry_id
  join core.branch b on b.branch_id = c.branch_id
  order by m.name`;
console.log("\n=== CHAPTERS ===");
for (const c of chapters) console.log(`${c.ministry} @ ${c.branch} [${c.status}]`);

await sql.end();
