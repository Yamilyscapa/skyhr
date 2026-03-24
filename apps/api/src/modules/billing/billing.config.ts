export type BillingTierKey =
  | "tier_1_20"
  | "tier_21_50"
  | "tier_51_100"
  | "tier_101_plus";

type BillingTier = {
  key: BillingTierKey;
  label: string;
  minUsers: number;
  maxUsers: number | null;
  baseAmountMxn: number;
  stripePriceId: string | null;
};

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseOverageAmount(): number {
  const raw = process.env.STRIPE_OVERAGE_PER_USER_MXN;
  if (!raw) {
    return 100;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }

  return Math.round(parsed);
}

export function getBillingTiers(): BillingTier[] {
  return [
    {
      key: "tier_1_20",
      label: "1-20 usuarios",
      minUsers: 1,
      maxUsers: 20,
      baseAmountMxn: 1500,
      stripePriceId: optionalEnv("STRIPE_PRICE_TIER_1_20"),
    },
    {
      key: "tier_21_50",
      label: "21-50 usuarios",
      minUsers: 21,
      maxUsers: 50,
      baseAmountMxn: 2500,
      stripePriceId: optionalEnv("STRIPE_PRICE_TIER_21_50"),
    },
    {
      key: "tier_51_100",
      label: "51-100 usuarios",
      minUsers: 51,
      maxUsers: 100,
      baseAmountMxn: 5000,
      stripePriceId: optionalEnv("STRIPE_PRICE_TIER_51_100"),
    },
    {
      key: "tier_101_plus",
      label: "101+ usuarios",
      minUsers: 101,
      maxUsers: null,
      baseAmountMxn: 5000,
      stripePriceId: optionalEnv("STRIPE_PRICE_TIER_51_100"),
    },
  ];
}

export function getOveragePriceId() {
  return requireEnv("STRIPE_PRICE_OVERAGE_101_PLUS");
}

export function getOveragePerUserMxn() {
  return parseOverageAmount();
}

export function getAppUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").trim();
}
