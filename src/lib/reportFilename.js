// src/lib/reportFilename.js
// Client/server safe — no Node-only imports.

/**
 * Build a report filename.
 *
 * Pattern: `9expert-report-<slug>-<startYMD>-to-<endYMD>.<ext>`
 *
 * Slug: restaurant name lowercased, whitespace → "-", Thai kept,
 * other non-alphanumerics stripped (except "-"). Fallback "merchant" if empty.
 *
 * @param {{ restaurantName: string, startYMD: string, endYMD: string, ext: "png"|"pdf" }} opts
 * @returns {string}
 */
export function buildReportFilename({ restaurantName, startYMD, endYMD, ext }) {
  let slug = String(restaurantName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    // Keep Thai (\\u0E00-\\u0E7F), alphanumerics, and hyphens
    .replace(/[^a-z0-9\u0E00-\u0E7F-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) slug = "merchant";

  return `9expert-report-${slug}-${startYMD}-to-${endYMD}.${ext}`;
}
