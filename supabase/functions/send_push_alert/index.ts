import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AlertRequest = {
  title: string;
  message: string;
  url?: string;
  level?: "info" | "warning" | "critical";
  category?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = (await req.json().catch(() => null)) as AlertRequest | null;
  if (!body || typeof body.title !== "string" || typeof body.message !== "string") {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const defaultIconUrl = Deno.env.get("ONESIGNAL_DEFAULT_ICON_URL") ?? "";
  const defaultImageUrl = Deno.env.get("ONESIGNAL_DEFAULT_IMAGE_URL") ?? "";
  if (!appId || !restApiKey) {
    return new Response(JSON.stringify({ error: "Missing OneSignal env vars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const level = body.level ?? "info";
  const category = typeof body.category === "string" && body.category.length > 0 ? body.category : "general";
  const titlePrefix = level === "critical" ? "CRITICAL ALERT: " : level === "warning" ? "WARNING: " : "ALERT: ";

  const payload: Record<string, unknown> = {
    app_id: appId,
    included_segments: ["Subscribed Users"],
    headings: { en: `${titlePrefix}${body.title}` },
    contents: { en: body.message },
    priority: level === "critical" ? 10 : level === "warning" ? 8 : 5,
    ttl: 7200,
    data: { level, category },
  };
  if (typeof body.url === "string" && body.url.length > 0) {
    payload.url = body.url;
  }
  if (defaultIconUrl.length > 0) {
    payload.chrome_web_icon = defaultIconUrl;
  }
  if (defaultImageUrl.length > 0) {
    payload.chrome_web_image = defaultImageUrl;
    payload.big_picture = defaultImageUrl;
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${restApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
