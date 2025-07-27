"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_printer_1 = __importDefault(require("@thiagoelg/node-printer"));
const promises_1 = __importDefault(require("fs/promises"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const node_thermal_printer_1 = require("node-thermal-printer");
const redis_1 = require("redis");
/* ── Verify driver loaded ─────────────────────────────── */
if (!node_printer_1.default || typeof node_printer_1.default?.printDirect !== "function") {
    console.error("❌  node-printer native addon failed to load. " +
        "Make sure *.node files were bundled via pkg.assets");
    process.exit(1);
}
/* ── Bootstrap ────────────────────────────────────────── */
async function start() {
    const cfg = js_yaml_1.default.load(await promises_1.default.readFile("agent.yaml", "utf8"));
    const redis = (0, redis_1.createClient)({ url: cfg.redis });
    await redis.connect();
    console.log("Agent ready – waiting for jobs …");
    while (true) {
        /* Block until a job arrives */
        const reply = await redis.blPop(cfg.queue, 0);
        if (!reply)
            continue; // (timeout case if you ever set >0)
        const job = JSON.parse(reply.element);
        const escpos = Buffer.from(job.bytes, "base64");
        /* Print */
        const printer = new node_thermal_printer_1.ThermalPrinter({
            type: node_thermal_printer_1.PrinterTypes.EPSON,
            interface: cfg.interfaceOverride ?? `printer:${cfg.printerQueue}`,
            driver: node_printer_1.default,
            width: 38,
            breakLine: node_thermal_printer_1.BreakLine.NONE,
            characterSet: node_thermal_printer_1.CharacterSet.PC852_LATIN2,
        });
        printer.raw(escpos);
        try {
            await printer.execute();
            console.log(`✅ printed ${job.id}`);
        }
        catch (err) {
            console.error(`🚨 print failed for ${job.id}:`, err);
        }
    }
}
start().catch(console.error);
