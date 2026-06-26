import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";

async function verifyTools() {
  const adapter = createMcpAdapter();
  // Provide a dummy authenticated token header so auth passes. 
  // It only needs to decode as a JWT with an unexpired exp and not be a service role.
  const payload = { sub: "test", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = "header." + Buffer.from(JSON.stringify(payload)).toString("base64").replace(/=/g, "") + ".signature";
  
  const result = await adapter.handleTools({ authorization: "Bearer " + token });
  
  if (result.status !== 200) {
    console.error("Failed to fetch tools:", result.body);
    process.exit(1);
  }

  const tools = result.body.tools as Array<{ name: string; description: string }>;
  const names = tools.map(t => t.name).sort();
  
  console.log("=== EXPOSED MCP TOOLS ===");
  names.forEach(name => console.log(`- ${name}`));
  
  const expected = [
    "get_grant_decision_brief",
    "list_grant_matches",
    "get_application_prep_context",
    "list_agent_knowledge_items",
    "get_agent_knowledge_item"
  ];
  
  console.log("\n=== MISSING CHECKS ===");
  for (const exp of expected) {
    const found = names.includes(exp);
    console.log(`${exp}: ${found ? "FOUND ✅" : "MISSING ❌"}`);
    if (!found) process.exitCode = 1;
  }
}

verifyTools().catch(console.error);
