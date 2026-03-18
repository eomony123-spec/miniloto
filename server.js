const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const ROOT = __dirname;
const CSV_URL = "https://www.japannetbank.co.jp/lottery/co/minilotojnb.csv";
const PASSWORD = process.env.WARUKUN_PASSWORD || "1234";
const SESSION_COOKIE = "warukun_session";
const SESSION_TOKEN = Math.random().toString(36).slice(2);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

    if (requestUrl.pathname === "/api/auth/status") {
      respondJson(response, 200, {
        authenticated: isAuthenticated(request),
      });
      return;
    }

    if (requestUrl.pathname === "/api/auth/login" && request.method === "POST") {
      await handleLoginRequest(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/auth/logout" && request.method === "POST") {
      clearSession(response);
      respondJson(response, 200, { ok: true });
      return;
    }

    if (requestUrl.pathname === "/api/miniloto/csv") {
      if (!isAuthenticated(request)) {
        respondJson(response, 401, { error: "認証が必要です。" });
        return;
      }
      await handleCsvRequest(response);
      return;
    }

    await serveStatic(requestUrl.pathname, response);
  } catch (error) {
    respondJson(response, 500, {
      error: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`割るくんを起動しました: http://${HOST}:${PORT}`);
});

async function handleCsvRequest(response) {
  const upstream = await fetch(CSV_URL, {
    headers: {
      "User-Agent": "WarukunLocalTool/1.0",
      Accept: "text/csv,*/*;q=0.8",
    },
  });

  if (!upstream.ok) {
    respondJson(response, 502, {
      error: `CSV取得に失敗しました (${upstream.status})`,
    });
    return;
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const decoder = new TextDecoder("shift-jis");
  const csvText = decoder.decode(buffer);

  respondJson(response, 200, {
    sourceUrl: CSV_URL,
    fetchedAt: new Date().toISOString(),
    csvText,
  });
}

async function handleLoginRequest(request, response) {
  const bodyText = await readRequestBody(request);
  let payload = {};

  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    respondJson(response, 400, { ok: false, error: "不正なリクエストです。" });
    return;
  }

  if (payload.password !== PASSWORD) {
    respondJson(response, 401, { ok: false, error: "パスワードが違います。" });
    return;
  }

  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${SESSION_TOKEN}; HttpOnly; SameSite=Lax; Path=/`);
  respondJson(response, 200, { ok: true });
}

async function serveStatic(urlPath, response) {
  let safePath = urlPath === "/" ? "/index.html" : urlPath;
  safePath = safePath.split("?")[0];

  const filePath = path.join(ROOT, safePath);
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(ROOT)) {
    respondText(response, 403, "Forbidden");
    return;
  }

  let stats;
  try {
    stats = await fs.promises.stat(normalizedPath);
  } catch {
    respondText(response, 404, "Not Found");
    return;
  }

  if (stats.isDirectory()) {
    respondText(response, 403, "Forbidden");
    return;
  }

  const extension = path.extname(normalizedPath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const content = await fs.promises.readFile(normalizedPath);

  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(content);
}

function respondJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function respondText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(text);
}

function isAuthenticated(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  return cookies[SESSION_COOKIE] === SESSION_TOKEN;
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((all, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) {
      return all;
    }
    all[rawKey] = rest.join("=");
    return all;
  }, {});
}

function clearSession(response) {
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
