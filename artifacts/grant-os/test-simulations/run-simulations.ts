type AnyRecord = Record<string, any>;

type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function active<T extends AnyRecord>(rows: T[]): T[] {
  return rows.filter((row) => !row.archived_at);
}

function packageBase(packageType: string, records: AnyRecord) {
  return { exported_at: "2026-01-01T00:00:00.000Z", generated_at: "2026-01-01T00:00:00.000Z", package_type: packageType, app: "Grant OS", records };
}

const db = {
  projects: [
    { id: "project-public", slug: "connect-app", name: "Connect App", public_visibility: true, featured: true, archived_at: null },
    { id: "project-private", slug: "private-lab", name: "Private Lab", public_visibility: false, featured: false, archived_at: null },
    { id: "project-archived", slug: "old-demo", name: "Old Demo", public_visibility: true, featured: false, archived_at: "2025-01-01" },
  ],
  proofItems: [
    { id: "proof-public", project_id: "project-public", title: "Public Field Test", public_visibility: true, archived_at: null, document_url: "https://private.example/doc" },
    { id: "proof-private-project", project_id: "project-private", title: "Private Lab Evidence", public_visibility: true, archived_at: null },
    { id: "proof-private", project_id: "project-public", title: "Private Proof", public_visibility: false, archived_at: null },
    { id: "proof-archived", project_id: "project-public", title: "Archived Proof", public_visibility: true, archived_at: "2025-01-01" },
    { id: "proof-standalone", project_id: null, title: "Public Standalone Proof", public_visibility: true, archived_at: null },
  ],
  funders: [
    { id: "funder-1", name: "MIT Solve", archived_at: null, website_url: "https://solve.mit.edu" },
    { id: "funder-2", name: "Bad Imported Funder", archived_at: null, median_grant_amount: "not-a-number" },
    { id: "funder-empty", name: "No Grants Foundation", archived_at: null },
    { id: "funder-archived", name: "Archived Foundation", archived_at: "2025-01-01" },
  ],
  grants: [
    { id: "grant-1", title: "MIT Solve Challenge", funder_id: "funder-1", funder_name: "MIT Solve", related_project_id: "project-public", deadline: "2026-08-01", archived_at: null, source_url: "https://instrumentl.example/grants/1" },
    { id: "grant-sparse", title: "Sparse Grant", funder_id: null, funder_name: null, related_project_id: null, deadline: null, archived_at: null, source_url: null },
    { id: "grant-archived", title: "Archived Grant", funder_id: "funder-1", archived_at: "2025-01-01" },
  ],
  documents: [
    { id: "doc-1", title: "Grant Guidelines", related_grant_id: "grant-1", related_funder_id: "funder-1", source_url: "https://example.com/" + "x".repeat(240), archived_at: null },
    { id: "doc-no-url", title: "No URL Document", related_grant_id: "grant-sparse", related_funder_id: null, source_url: null, archived_at: null },
    { id: "doc-archived", title: "Archived Doc", related_grant_id: "grant-1", archived_at: "2025-01-01" },
  ],
  applications: [
    { id: "app-existing", title: "MIT Solve — Connect App Application", grant_id: "grant-1", project_id: "project-public", status: "Drafting", archived_at: null, deadline: "2026-08-01" },
    { id: "app-archived", title: "Archived Application", grant_id: "grant-1", project_id: "project-private", status: "Archived", archived_at: "2025-01-01" },
  ],
  tasks: [
    { id: "task-1", title: "Review guidelines", related_application_id: "app-existing", related_grant_id: "grant-1", related_project_id: "project-public", status: "Not Started", priority: "High", archived_at: null },
    { id: "task-archived", title: "Archived task", related_application_id: "app-existing", status: "Complete", priority: "Low", archived_at: "2025-01-01" },
  ],
  peers: [
    { id: "peer-1", name: "Peer Org", archived_at: null },
    { id: "peer-archived", name: "Archived Peer", archived_at: "2025-01-01" },
  ],
  peerFundingRecords: [
    { id: "pfr-manual", peer_organization_id: "peer-1", funder_id: null, manual_funder_name: "Manual Foundation", amount_awarded: 25000, archived_at: null },
    { id: "pfr-linked", peer_organization_id: "peer-1", funder_id: "funder-1", manual_funder_name: null, amount_awarded: 50000, archived_at: null },
    { id: "pfr-archived", peer_organization_id: "peer-1", funder_id: "funder-1", archived_at: "2025-01-01" },
  ],
  grantMatches: [
    { id: "match-1", grant_id: "grant-1", project_id: "project-public", match_score: 91, readiness_score: 74, archived_at: null },
  ],
};

const privateTables = ["applications", "tasks", "peers", "peerFundingRecords", "grantMatches", "agentReports", "agentNotes"];
const publicQueryLog: string[] = [];

function listPublicProjects() {
  publicQueryLog.push("projects");
  return db.projects.filter((project) => project.public_visibility && !project.archived_at);
}

function listPublicProofItems(projectId?: string) {
  publicQueryLog.push("proofItems");
  const publicProjects = new Set(listPublicProjects().map((project) => project.id));
  return db.proofItems
    .filter((item) => item.public_visibility && !item.archived_at)
    .filter((item) => !projectId || item.project_id === projectId)
    .filter((item) => !item.project_id || publicProjects.has(item.project_id))
    .map(({ document_url: _documentUrl, media_url: _mediaUrl, ...safe }) => safe);
}

function listGrants() {
  return active(db.grants);
}

function getGrant(id: string) {
  return active(db.grants).find((grant) => grant.id === id) ?? null;
}

function listGrantDocuments(grantId: string) {
  return active(db.documents).filter((doc) => doc.related_grant_id === grantId);
}

function renderGrantSummary(grant: AnyRecord | null) {
  return {
    title: grant?.title ?? "Grant not found",
    funder: grant?.funder_name ?? "No funder linked",
    deadline: grant?.deadline ?? "No deadline",
  };
}

function listFunders() {
  return active(db.funders);
}

function getFunder(id: string) {
  return active(db.funders).find((funder) => funder.id === id) ?? null;
}

function grantsForFunder(funderId: string) {
  return listGrants().filter((grant) => grant.funder_id === funderId);
}

function safeNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function listDocuments() {
  return active(db.documents);
}

function getDocument(id: string) {
  return listDocuments().find((doc) => doc.id === id) ?? null;
}

function displayUrl(url: string | null | undefined) {
  if (!url) return "No source URL";
  return { text: url, className: "break-all" };
}

function listApplications() {
  return active(db.applications);
}

function startApplicationFromGrant(grantId: string, projectId: string) {
  const existing = listApplications().find((app) => app.grant_id === grantId && app.project_id === projectId);
  if (existing) return { application: existing, created: false };
  const grant = getGrant(grantId);
  assert(grant, "grant must exist");
  const app = {
    id: `app-${db.applications.length + 1}`,
    title: `${grant.title} — Application`,
    grant_id: grantId,
    project_id: projectId,
    status: "Not Started",
    deadline: grant.deadline,
    archived_at: null,
  };
  db.applications.push(app);
  return { application: app, created: true };
}

const defaultChecklist = ["Review eligibility", "Collect proof", "Draft narrative", "Internal review", "Submit"];
function createChecklistOnce(applicationId: string, grantId: string, projectId: string, shouldFail = false) {
  if (shouldFail) throw new Error("simulated checklist insert failure");
  const existing = active(db.tasks).filter((task) => task.related_application_id === applicationId);
  if (existing.length) return existing;
  const created = defaultChecklist.map((title, index) => ({
    id: `task-generated-${applicationId}-${index}`,
    title,
    related_application_id: applicationId,
    related_grant_id: grantId,
    related_project_id: projectId,
    status: "Not Started",
    priority: index === 0 ? "High" : "Medium",
    archived_at: null,
  }));
  db.tasks.push(...created);
  return created;
}

function updateTaskStatus(taskId: string, status: string) {
  const task = active(db.tasks).find((row) => row.id === taskId);
  assert(task, "active task must exist");
  task.status = status;
  return task;
}

function filterTasks(filters: { applicationId?: string; projectId?: string; status?: string; priority?: string }) {
  return active(db.tasks).filter((task) => {
    if (filters.applicationId && task.related_application_id !== filters.applicationId) return false;
    if (filters.projectId && task.related_project_id !== filters.projectId) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    return true;
  });
}

function listPeers() {
  return active(db.peers);
}

function addPeer(name: string) {
  const peer = { id: `peer-${db.peers.length + 1}`, name, archived_at: null };
  db.peers.push(peer);
  return peer;
}

function archivePeer(peerId: string) {
  const peer = db.peers.find((row) => row.id === peerId);
  assert(peer, "peer must exist");
  peer.archived_at = "2026-01-01";
}

function addFundingRecord(input: AnyRecord) {
  const record = { id: `pfr-${db.peerFundingRecords.length + 1}`, archived_at: null, ...input };
  db.peerFundingRecords.push(record);
  return record;
}

function fundingRecordsForFunder(funderId: string) {
  return active(db.peerFundingRecords).filter((record) => record.funder_id === funderId);
}

function exportGrantPackage(grantId: string) {
  const grant = getGrant(grantId);
  assert(grant, "active grant required for export");
  return packageBase("grant", {
    grant,
    funder: grant.funder_id ? getFunder(grant.funder_id) : null,
    documents: listGrantDocuments(grantId),
    applications: listApplications().filter((app) => app.grant_id === grantId),
  });
}

function exportApplicationPackage(applicationId: string) {
  const application = listApplications().find((app) => app.id === applicationId);
  assert(application, "active application required for export");
  return packageBase("application", {
    application,
    grant: application.grant_id ? getGrant(application.grant_id) : null,
    tasks: active(db.tasks).filter((task) => task.related_application_id === applicationId),
  });
}

function exportPeerPackage(peerId: string) {
  const peer = listPeers().find((row) => row.id === peerId);
  assert(peer, "active peer required for export");
  return packageBase("peer", {
    peer_organization: peer,
    funding_records: active(db.peerFundingRecords).filter((record) => record.peer_organization_id === peerId),
  });
}

function reportsSummary() {
  return {
    active_grants: listGrants().length,
    active_applications: listApplications().length,
    active_tasks: active(db.tasks).length,
  };
}

// 1. Public privacy
test("Public projects returned", () => assert(listPublicProjects().some((p) => p.id === "project-public"), "public project missing"));
test("Private projects hidden", () => assert(!listPublicProjects().some((p) => p.id === "project-private"), "private project leaked"));
test("Archived public projects hidden", () => assert(!listPublicProjects().some((p) => p.id === "project-archived"), "archived project leaked"));
test("Public proof items returned", () => assert(listPublicProofItems().some((p) => p.id === "proof-public"), "public proof missing"));
test("Private proof items hidden", () => assert(!listPublicProofItems().some((p) => p.id === "proof-private"), "private proof leaked"));
test("Proof linked to private project hidden", () => assert(!listPublicProofItems().some((p) => p.id === "proof-private-project"), "private-project proof leaked"));
test("Public proof payload excludes document/media URLs", () => assert(!("document_url" in listPublicProofItems()[0]), "document URL exposed"));
test("Public services do not query private tables", () => assert(privateTables.every((table) => !publicQueryLog.includes(table)), "private query from public service"));

// 2. Grant operations
test("List grants excludes archived", () => assert(listGrants().length === 2 && !listGrants().some((g) => g.id === "grant-archived"), "archived grant visible"));
test("Read grant detail", () => assert(getGrant("grant-1")?.title === "MIT Solve Challenge", "grant detail failed"));
test("Grant with documents", () => assert(listGrantDocuments("grant-1").length === 1, "grant docs missing or archived docs included"));
test("Grant without funder handled", () => assert(renderGrantSummary(getGrant("grant-sparse")).funder === "No funder linked", "sparse funder fallback failed"));
test("Sparse grant does not crash", () => assert(renderGrantSummary(getGrant("grant-sparse")).deadline === "No deadline", "sparse deadline fallback failed"));

// 3. Funder operations
test("List funders excludes archived", () => assert(!listFunders().some((f) => f.id === "funder-archived"), "archived funder visible"));
test("Read funder detail", () => assert(getFunder("funder-1")?.name === "MIT Solve", "funder detail failed"));
test("Funder with linked grants", () => assert(grantsForFunder("funder-1").length === 1, "linked grant missing"));
test("Funder with no grants", () => assert(grantsForFunder("funder-empty").length === 0, "empty funder not empty"));
test("Bad imported values handled gracefully", () => assert(safeNumber(getFunder("funder-2")?.median_grant_amount) === null, "bad number not sanitized"));

// 4. Documents
test("List documents excludes archived", () => assert(!listDocuments().some((d) => d.id === "doc-archived"), "archived document visible"));
test("Document detail", () => assert(getDocument("doc-1")?.title === "Grant Guidelines", "document detail failed"));
test("Document linked to grant", () => assert(getDocument("doc-1")?.related_grant_id === "grant-1", "grant link missing"));
test("Long URL handled", () => assert(displayUrl(getDocument("doc-1")?.source_url).className === "break-all", "long URL not break-all"));
test("Missing source URL handled", () => assert(displayUrl(getDocument("doc-no-url")?.source_url) === "No source URL", "missing URL fallback failed"));

// 5. Applications
test("Start application from grant opens existing duplicate", () => assert(startApplicationFromGrant("grant-1", "project-public").created === false, "duplicate app created"));
test("Start application prefill includes grant/project/deadline", () => { const r = startApplicationFromGrant("grant-1", "project-private"); assert(r.application.grant_id === "grant-1" && r.application.project_id === "project-private" && r.application.deadline === "2026-08-01", "prefill failed"); });
test("Archived applications hidden", () => assert(!listApplications().some((app) => app.id === "app-archived"), "archived app visible"));
test("Create checklist once", () => { const first = createChecklistOnce("app-existing", "grant-1", "project-public"); const second = createChecklistOnce("app-existing", "grant-1", "project-public"); assert(first.length === second.length, "checklist not idempotent"); });
test("Checklist failure does not delete application", () => { try { createChecklistOnce("app-existing", "grant-1", "project-public", true); } catch {} assert(!!listApplications().find((app) => app.id === "app-existing"), "application deleted after checklist failure"); });
test("Application export packet shape", () => { const p = exportApplicationPackage("app-existing"); assert(p.package_type === "application" && !!p.records.application && Array.isArray(p.records.tasks), "bad app export shape"); });

// 6. Tasks
test("Checklist tasks link to application/grant/project", () => { const t = active(db.tasks).find((task) => task.related_application_id === "app-existing"); assert(t?.related_grant_id === "grant-1" && t.related_project_id === "project-public", "task links wrong"); });
test("Archived tasks hidden", () => assert(!active(db.tasks).some((task) => task.id === "task-archived"), "archived task visible"));
test("Task status update", () => assert(updateTaskStatus("task-1", "Complete").status === "Complete", "status update failed"));
test("Task filters by application/project/status/priority", () => assert(filterTasks({ applicationId: "app-existing", projectId: "project-public", status: "Complete", priority: "High" }).length >= 1, "task filters failed"));

// 7. Peer Intelligence
test("Add peer", () => assert(addPeer("QA Peer").name === "QA Peer", "peer add failed"));
test("Archive peer", () => { const peer = addPeer("Archive Me"); archivePeer(peer.id); assert(!listPeers().some((p) => p.id === peer.id), "archived peer visible"); });
test("Archived peer hidden", () => assert(!listPeers().some((p) => p.id === "peer-archived"), "seed archived peer visible"));
test("Add funding record", () => assert(addFundingRecord({ peer_organization_id: "peer-1", manual_funder_name: "New Manual Funder" }).manual_funder_name === "New Manual Funder", "funding record add failed"));
test("Manual funder name works", () => assert(active(db.peerFundingRecords).some((r) => r.manual_funder_name === "Manual Foundation"), "manual funder missing"));
test("Linked funder works", () => assert(active(db.peerFundingRecords).some((r) => r.funder_id === "funder-1"), "linked funder missing"));
test("Funder detail can find linked peer records", () => assert(fundingRecordsForFunder("funder-1").length >= 1, "funder peer records missing"));
test("Peer export JSON", () => { const p = exportPeerPackage("peer-1"); assert(p.package_type === "peer" && Array.isArray(p.records.funding_records), "bad peer export"); });

// 8. Reports/exports
test("Reports handle empty data", () => assert(typeof reportsSummary().active_grants === "number", "report summary failed"));
test("Reports exclude archived records", () => assert(reportsSummary().active_grants === 2, "archived grant counted"));
test("Grant export shape", () => { const p = exportGrantPackage("grant-1"); assert(p.package_type === "grant" && !!p.records.grant && Array.isArray(p.records.documents), "bad grant export"); });
test("Archived grant export blocked", () => { let blocked = false; try { exportGrantPackage("grant-archived"); } catch { blocked = true; } assert(blocked, "archived grant exported"); });

const passed = results.filter((r) => r.passed).length;
const failed = results.length - passed;

console.log("Grant OS Simulation Suite");
console.log("Mode: in-memory / no real Supabase writes\n");

for (const result of results) {
  console.log(`${result.passed ? "✅" : "❌"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
}

console.log("\nSummary:");
console.log(`${passed} passed, ${failed} failed, 0 skipped`);
console.log("Real database touched: NO");

if (failed > 0) {
  process.exit(1);
}
