import { toEspnCode } from "./espn";

export function teamLogoUrl(code: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${toEspnCode(code)}.png`;
}
