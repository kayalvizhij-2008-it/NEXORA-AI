import { expect, test } from "@playwright/test";

test("welcome screen presents the NEXORA AI brand", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/NEXORA AI/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Intelligence in motion.");
  await expect(page.getByText("Agents in action.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter the workspace" })).toHaveAttribute("href", "/app/dashboard");
});

test("every workspace route renders its own page", async ({ page }) => {
  const pages = [
    { path: "/app/dashboard", title: "Good to see you." },
    { path: "/app/command", title: "Command center" },
    { path: "/app/agents", title: "Meet your agents." },
    { path: "/app/workflows", title: "Workflows, in view." },
    { path: "/app/research", title: "Follow the evidence." },
    { path: "/app/memory", title: "Memory & skills." },
    { path: "/app/approvals", title: "Review before resuming." },
    { path: "/app/history", title: "Every run, accounted for." },
    { path: "/app/documents", title: "Document analysis." },
    { path: "/app/exports", title: "Take your work with you." },
    { path: "/app/settings", title: "Settings." },
  ];

  for (const route of pages) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.title })).toBeVisible();
  }
});

test("agent directory is populated from the connected LangGraph registry", async ({ page, request }) => {
  const health = await request.get("http://127.0.0.1:2024/ok");
  expect(health.ok(), "Start `uv run langgraph dev` before running the live integration tests.").toBeTruthy();

  await page.goto("/app/agents");
  await expect(page.getByRole("heading", { name: "Meet your agents." })).toBeVisible();
  await expect(page.locator(".agent-card")).toHaveCount(9);
  await expect(page.getByRole("heading", { name: "Research Agent", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deep Agent", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View Deep Agent details" }).click();
  await expect(page.getByText("GRAPH CAPABILITIES · LIVE SCHEMA")).toBeVisible();
  await expect(page.getByText("HumanInTheLoopMiddleware.after_model", { exact: true })).toBeVisible();
});

test("workflow visualizer renders the graph schema returned by LangGraph", async ({ page, request }) => {
  const health = await request.get("http://127.0.0.1:2024/ok");
  expect(health.ok(), "Start `uv run langgraph dev` before running the live integration tests.").toBeTruthy();

  await page.goto("/app/workflows");
  const graph = page.getByRole("img", { name: "Interactive graph visualization returned by LangGraph" });
  await expect(graph).toBeVisible({ timeout: 30_000 });
  await expect(graph.getByText("__start__")).toBeVisible();
  await expect(page.getByText("nodes", { exact: false }).first()).toBeVisible();
});

test("mobile navigation opens and routes to the selected workspace page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Meet your agents." })).toBeVisible();
});

test("motion preference can be changed without affecting backend configuration", async ({ page }) => {
  await page.goto("/app/settings");
  const toggle = page.getByRole("button", { name: "Reduce motion" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});

test("both 3D WebGL components CorollaGleam and FoldingParticleShell are rendered", async ({ page }) => {
  await page.goto("/");
  // Verify FoldingParticleShell canvas in global atmosphere
  const backgroundScene = page.locator(".glimmervale-scene canvas");
  await expect(backgroundScene).toBeVisible();

  // Verify CorollaGleam 3D canvas in landing hero
  const corollaGleam = page.locator(".corolla-gleam-container canvas").first();
  await expect(corollaGleam).toBeVisible();
});

test("document intelligence preloads and displays sample operations brief", async ({ page }) => {
  await page.goto("/app/documents");
  await expect(page.getByRole("heading", { name: "Document analysis." })).toBeVisible();
  await page.getByRole("button", { name: "Load sample brief" }).click();
  await expect(page.getByText("NEXORA_AI_Sample_Operations_Brief.pdf")).toBeVisible();
  await expect(page.getByText("PARSED DOCUMENT PREVIEW")).toBeVisible();
});
