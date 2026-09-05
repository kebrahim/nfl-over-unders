// ESPN's team logo CDN uses lowercase abbreviations that mostly match our
// team codes, with a couple of known exceptions (e.g. Washington is "wsh",
// not "was").
const ESPN_CODE_OVERRIDES: Record<string, string> = {
  WAS: "wsh",
};

export function teamLogoUrl(code: string): string {
  const espnCode = ESPN_CODE_OVERRIDES[code] ?? code.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnCode}.png`;
}
