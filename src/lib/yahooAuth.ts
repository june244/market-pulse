/**
 * Shared Yahoo Finance crumb + cookie auth.
 * Used by /api/market and /api/sentiment for endpoints that require it
 * (quote, quoteSummary, etc.).
 */

export const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let cachedCrumb: string | null = null;
let cachedCookies: string | null = null;
let crumbExpiry = 0;

const CRUMB_TTL_MS = 20 * 60 * 1000; // 20 minutes

export async function getYahooCrumb(
  forceRefresh = false,
): Promise<{ crumb: string; cookies: string }> {
  if (!forceRefresh && cachedCrumb && cachedCookies && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookies: cachedCookies };
  }

  // Step 1: Hit fc.yahoo.com to obtain consent cookies
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': YAHOO_UA },
    redirect: 'manual',
    cache: 'no-store',
  });

  const setCookieHeaders = cookieRes.headers.getSetCookie?.() ?? [];
  const cookies = setCookieHeaders.map((c: string) => c.split(';')[0]).join('; ');
  if (!cookies) throw new Error('No cookies received from Yahoo');

  // Step 2: Exchange cookies for a crumb token
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': YAHOO_UA, Cookie: cookies },
    cache: 'no-store',
  });
  if (!crumbRes.ok) throw new Error(`Crumb fetch failed: ${crumbRes.status}`);
  const crumb = await crumbRes.text();

  cachedCrumb = crumb;
  cachedCookies = cookies;
  crumbExpiry = Date.now() + CRUMB_TTL_MS;

  return { crumb, cookies };
}
