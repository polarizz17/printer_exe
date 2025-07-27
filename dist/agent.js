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
if (!node_printer_1.default) {
    console.error("node-printer failed to load; check pkg assets!");
    process.exit(1);
}
async function start() {
    const cfg = js_yaml_1.default.load(await promises_1.default.readFile("agent.yaml", "utf8"));
    const redis = (0, redis_1.createClient)({ url: cfg.redis });
    await redis.connect();
    console.log("Agent ready - waiting for jobs …");
    while (true) {
        const reply = await redis.blPop(cfg.queue, 0);
        console.log("got the reply", reply);
        if (!reply)
            continue;
        const raw = reply.element;
        const job = JSON.parse(raw);
        const data = Buffer.from(job.bytes, "base64");
        console.log("got the data", data);
        const tp = new node_thermal_printer_1.ThermalPrinter({
            type: node_thermal_printer_1.PrinterTypes.EPSON,
            interface: cfg.interfaceOverride ?? `printer:${cfg.printerQueue}`,
            driver: node_printer_1.default,
            width: 38,
            breakLine: node_thermal_printer_1.BreakLine.NONE,
            characterSet: node_thermal_printer_1.CharacterSet.PC852_LATIN2,
        });
        tp.raw(data);
        await tp.execute();
        console.log("✅ printed", job.id);
    }
}
start().catch(console.error);
