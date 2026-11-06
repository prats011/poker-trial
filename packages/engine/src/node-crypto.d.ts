declare module "node:crypto" {
  export function randomInt(maxExclusive: number): number;
  export function randomUUID(): string;
}
