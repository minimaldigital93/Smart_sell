/** Points earned per $1 of order total (rounded down). */
export const POINTS_PER_DOLLAR = 1;

/** How many points equal $1 of discount. */
export const POINTS_PER_DOLLAR_CREDIT = 100;

/** Maximum share of subtotal the customer can offset with points (0–1). */
export const MAX_POINTS_REDEMPTION_RATIO = 0.5;

/** Convert a points amount to its USD monetary value. */
export function pointsToUsd(points: number): number {
  return Number((points / POINTS_PER_DOLLAR_CREDIT).toFixed(2));
}

/** Convert a USD amount to the number of points needed to cover it. */
export function usdToPoints(usd: number): number {
  return Math.ceil(usd * POINTS_PER_DOLLAR_CREDIT);
}

/** How many points a customer would earn for a given order total. */
export function calcPointsEarned(orderTotal: number): number {
  return Math.floor(orderTotal * POINTS_PER_DOLLAR);
}
