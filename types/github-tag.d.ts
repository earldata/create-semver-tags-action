declare module "semver" {
  export function gte(a: string, b: string): boolean;
  export function parse(version: string): SemVer;
  class SemVer {
    major: number;
    minor: number;
    patch: number;
    minorVersionTag: string;
    majorVersionTag: string;
  }
}
declare module "githubtag/lib/action";
declare module "githubtag/lib/github";
declare module "githubtag/lib/utils";
