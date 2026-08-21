import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + String(Date.now()));
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders OfficeFlow shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.ok((response.headers.get("content-type") || "").startsWith("text/html"));

  const html = await response.text();
  assert.match(html, /<title>OfficeFlow Task Hub<\/title>/i);
  assert.match(html, /Daily Task Hub/);
  assert.match(html, /Board/);
  assert.match(html, /Overdue/);
  assert.match(html, /Blocked/);
  assert.match(html, /Date filters/i);
  assert.match(html, /Assigned at/);
  assert.match(html, /Status changed/);
  assert.match(html, /Recent Activity/);
  assert.match(html, /Supabase-backed daily office task tracker/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});
