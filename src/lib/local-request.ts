const localHostnames = new Set(["localhost", "127.0.0.1"]);

export function isLocalRequest(request: Request) {
  const host = request.headers.get("host");
  if (!host) return false;

  let requestOrigin: URL;
  try {
    requestOrigin = new URL(`${new URL(request.url).protocol}//${host}`);
  } catch {
    return false;
  }
  if (requestOrigin.host !== host) return false;
  if (!localHostnames.has(requestOrigin.hostname)) return false;

  const origin = request.headers.get("origin");
  return !origin || origin === requestOrigin.origin;
}
