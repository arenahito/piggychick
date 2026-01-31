import { resolve } from "node:path";
import { startServer } from "./app";
import { resolveTasksRootFromEnv } from "../shared/tasks-root";

const tasksRoot = resolveTasksRootFromEnv(resolve(process.cwd(), ".tasks"));
const distRoot = resolve("dist");

await startServer({ tasksRoot, distRoot });
