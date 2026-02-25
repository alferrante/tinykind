export function getAppBaseUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const base = configured || fallbackOrigin || "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export function buildAppUrl(pathname: string, fallbackOrigin?: string): URL {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, `${getAppBaseUrl(fallbackOrigin)}/`);
}
