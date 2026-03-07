// Global SSE clients store — shared across all modules
const clients = new Map();

function pushToClients(companyId, notification) {
  const id = companyId.toString();
  console.log("📨 PUSH attempting to:", id);
  console.log("📨 clients map:", [...clients.keys()]);

  if (!clients.has(id)) {
    console.log("❌ NO CLIENT FOUND for:", id);
    return;
  }

  console.log("✅ Found", clients.get(id).size, "client(s)");
  const payload = JSON.stringify({ type: "notification", data: notification });
  clients.get(id).forEach((res) => {
    try {
      res.write(`data: ${payload}\n\n`);
      console.log("✅ SSE pushed successfully");
    } catch (e) {
      console.log("❌ SSE write failed:", e.message);
      clients.get(id)?.delete(res);
    }
  });
}
function addClient(companyId, res) {
  const id = companyId.toString();
  if (!clients.has(id)) clients.set(id, new Set());
  clients.get(id).add(res);
  console.log(
    "✅ SSE client added, companyId:",
    id,
    "| Total companies:",
    clients.size
  );
}

function removeClient(companyId, res) {
  const id = companyId.toString();
  clients.get(id)?.delete(res);
  if (clients.get(id)?.size === 0) clients.delete(id);
  console.log("❌ SSE client removed, companyId:", id);
}

module.exports = { clients, pushToClients, addClient, removeClient };
