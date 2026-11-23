
const ALLOWED_ORIGINS = [
  "https://twitai.app",
  "https://www.twitai.app"
];

export async function onRequest({ request, next }) {
  const origin = request.headers.get("Origin") || "";

  const headers = new Headers();

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type"
    );
    headers.set("Access-Control-Max-Age", "86400");
    headers.append("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers
    });
  }

  const response = await next();
  const newHeaders = new Headers(response.headers);

  headers.forEach((value, key) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
