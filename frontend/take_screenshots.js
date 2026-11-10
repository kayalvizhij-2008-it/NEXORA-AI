import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  const outDir = path.resolve("./test-results");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    console.log("Capturing Landing page...");
    await page.goto("http://127.0.0.1:5173/", { timeout: 15000, waitUntil: "networkidle" });
    await page.waitForTimeout(2000); // let 3D WebGL render
    await page.screenshot({ path: path.join(outDir, "nexora-landing.png"), fullPage: false });

    console.log("Capturing Dashboard...");
    await page.goto("http://127.0.0.1:5173/app/dashboard", { timeout: 15000, waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, "nexora-dashboard.png"), fullPage: false });

    console.log("Capturing Command Center...");
    await page.goto("http://127.0.0.1:5173/app/command", { timeout: 15000, waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, "nexora-command.png"), fullPage: false });

    console.log("Capturing Document Analysis...");
    await page.goto("http://127.0.0.1:5173/app/documents", { timeout: 15000, waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, "nexora-documents.png"), fullPage: false });

    console.log("Screenshots captured successfully!");
  } catch (err) {
    console.error("Screenshot error:", err.message);
  } finally {
    await browser.close();
  }
}

run();
