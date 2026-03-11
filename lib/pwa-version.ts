import packageJson from "@/package.json";

const configuredVersion = process.env.NEXT_PUBLIC_PWA_VERSION?.trim();
const resolvedVersion = configuredVersion && configuredVersion.length > 0 ? configuredVersion : packageJson.version;

export const pwaVersion = resolvedVersion;
export const pwaVersionLabel = resolvedVersion.startsWith("v") ? resolvedVersion : `v${resolvedVersion}`;
