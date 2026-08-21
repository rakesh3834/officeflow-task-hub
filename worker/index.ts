/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const APPS_SCRIPT_URL_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i;

type SheetProxyBody = {
  scriptUrl?: string;
  token?: string;
  actor?: string;
  action?: string;
  payload?: Record<string, unknown>;
};

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/sheet") {
      return handleSheetProxy(request);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

async function handleSheetProxy(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Use POST for Sheet sync." }, 405);
  }

  let body: SheetProxyBody;
  try {
    body = (await request.json()) as SheetProxyBody;
  } catch {
    return jsonResponse({ ok: false, error: "Sheet sync request was not readable." }, 400);
  }

  const scriptUrl = String(body.scriptUrl || "").trim();
  const token = String(body.token || "").trim();
  const action = String(body.action || "").trim();
  if (!APPS_SCRIPT_URL_PATTERN.test(scriptUrl)) {
    return jsonResponse({ ok: false, error: "Paste the Apps Script Web App URL ending in /exec." }, 400);
  }
  if (!token) {
    return jsonResponse({ ok: false, error: "App token is missing." }, 400);
  }
  if (!action) {
    return jsonResponse({ ok: false, error: "Sheet action is missing." }, 400);
  }

  try {
    let appsScriptResponse = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action,
        token,
        actor: body.actor || "User",
        ...(body.payload || {}),
      }),
      redirect: "manual",
    });
    if (appsScriptResponse.status >= 300 && appsScriptResponse.status < 400) {
      const redirectLocation = appsScriptResponse.headers.get("Location");
      if (!redirectLocation) {
        return jsonResponse({ ok: false, error: "Apps Script redirected without a response URL." }, 502);
      }
      appsScriptResponse = await fetch(new URL(redirectLocation, scriptUrl).toString(), {
        method: "GET",
        redirect: "follow",
      });
    }
    const text = await appsScriptResponse.text();
    if (text.trim().startsWith("<")) {
      return jsonResponse(
        {
          ok: false,
          error: "Apps Script returned an HTML page. Redeploy the Web App and use the /exec URL.",
        },
        502,
      );
    }
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      return jsonResponse({ ok: false, error: "Apps Script returned unreadable data." }, 502);
    }
    return jsonResponse(result, appsScriptResponse.ok ? 200 : 502);
  } catch {
    return jsonResponse({ ok: false, error: "OfficeFlow could not reach Apps Script from the server." }, 502);
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
