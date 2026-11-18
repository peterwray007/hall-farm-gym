import { NextRequest, NextResponse } from "next/server";

// Keep checkout returns, receipts and the existing fridge QR destination accessible.
const shopPages = new Set(["/shop", "/shop/success"]);
const shopEndpoints = new Set([
  "/api/shop/checkout",
  "/api/shop/confirmation",
  "/api/stripe/webhook",
]);
const publicFiles = new Set([
  "/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/sw.js",
  "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/hall-farm-gym-logo.webp",
]);

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, "");
  if (shopPages.has(path) || shopEndpoints.has(path) || publicFiles.has(path)) {
    return NextResponse.next();
  }
  if (path.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.redirect(new URL("/shop", request.url), 307);
}

export const config = { matcher: ["/((?!_next/static/|_next/image).*)"] };
