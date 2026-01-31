import { resolve } from "node:path";
import { startServer } from "./app";

const tasksRoot = process.argv[2] ?? ".tasks";
const distRoot = resolve("dist");

await startServer({ tasksRoot, distRoot });
