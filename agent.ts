import nodePrinter from "@thiagoelg/node-printer";
import fs from "fs/promises";
import yaml from "js-yaml";
import {
  BreakLine,
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from "node-thermal-printer";
import { createClient } from "redis";

/* ── Verify driver loaded ─────────────────────────────── */
if (!nodePrinter || typeof nodePrinter?.printDirect !== "function") {
  console.error(
    "❌  node-printer native addon failed to load. " +
      "Make sure *.node files were bundled via pkg.assets"
  );
  process.exit(1);
}

/* ── Bootstrap ────────────────────────────────────────── */
async function start() {
  const cfg = yaml.load(await fs.readFile("agent.yaml", "utf8")) as any;

  const redis = createClient({ url: cfg.redis });
  await redis.connect();

  console.log("Agent ready – waiting for jobs …");

  while (true) {
    /* Block until a job arrives */
    const reply = await redis.blPop(cfg.queue, 0);
    if (!reply) continue; // (timeout case if you ever set >0)

    const job = JSON.parse(reply.element);
    const escpos = Buffer.from(job.bytes, "base64");

    /* Print */
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: cfg.interfaceOverride ?? `printer:${cfg.printerQueue}`,
      driver: nodePrinter,
      width: 38,
      breakLine: BreakLine.NONE,
      characterSet: CharacterSet.PC852_LATIN2,
    });

    printer.raw(escpos);

    try {
      await printer.execute();
      console.log(`✅ printed ${job.id}`);
    } catch (err) {
      console.error(`🚨 print failed for ${job.id}:`, err);
    }
  }
}

start().catch(console.error);
