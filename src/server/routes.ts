import { listPrds, readMarkdown, readPlan, TasksError } from "./tasks";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const jsonError = (status: number, code: string, message: string) => {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: jsonHeaders,
  });
};

const handleTasksError = (error: unknown) => {
  if (error instanceof TasksError) {
    return jsonError(error.status, error.code, error.message);
  }
  return jsonError(500, "internal_error", "Unexpected server error");
};

export const handleApiRequest = async (request: Request, tasksRoot: string) => {
  if (request.method !== "GET") {
    return jsonError(405, "method_not_allowed", "Method not allowed");
  }

  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 2 && segments[1] === "prds") {
    try {
      const prds = await listPrds(tasksRoot);
      return new Response(JSON.stringify(prds), { headers: jsonHeaders });
    } catch (error) {
      return handleTasksError(error);
    }
  }

  if (segments.length === 4 && segments[1] === "prds") {
    const prd = segments[2];
    const doc = segments[3];

    try {
      if (doc === "plan") {
        const payload = await readPlan(tasksRoot, prd);
        return new Response(JSON.stringify(payload), { headers: jsonHeaders });
      }
      const payload = await readMarkdown(tasksRoot, prd, doc);
      return new Response(JSON.stringify(payload), { headers: jsonHeaders });
    } catch (error) {
      return handleTasksError(error);
    }
  }

  return jsonError(404, "not_found", "Not found");
};
