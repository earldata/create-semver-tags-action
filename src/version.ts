import * as version from "./version";
import * as core from "@actions/core";
import { context } from "@actions/github";
import { parse, SemVer } from "semver";
import {
  getBranchFromRef,
  getLatestTag,
  getValidTags,
} from "githubtag/lib/utils";
import { getOctokitSingleton, createTag } from "githubtag/lib/github";

export async function applyAdditionalTags(): Promise<void> {
  if (version.isReleaseBranch()) {
    const { GITHUB_SHA } = process.env;
    const tagPrefix = core.getInput("tag_prefix");
    const createAnnotatedTag = !!core.getInput("create_annotated_tag");
    const semver = await version.getSemanticVersion(tagPrefix);

    await version.tagVersion(
      semver.minorVersionTag,
      createAnnotatedTag,
      GITHUB_SHA
    );
    await version.tagVersion(
      semver.majorVersionTag,
      createAnnotatedTag,
      GITHUB_SHA
    );
  }
}

export async function tagVersion(
  tag: string,
  createAnnotatedTag: boolean,
  sha: string | undefined
): Promise<void> {
  const tagExists = await version.refExists(tag);
  if (!tagExists) {
    core.info(`Tagging version: ${tag}`);
    await createTag(tag, createAnnotatedTag, sha);
  } else {
    core.info(`Moving existing version tag: ${tag} to ${sha}`);
    await version.updateTag(tag, sha);
  }
}

export function calculateMajorVersionTag(
  tagPrefix: string,
  semver: SemVer
): string {
  return `${tagPrefix}${semver.major}`;
}

export function calculateMinorVersionTag(
  tagPrefix: string,
  semver: SemVer,
  increment: boolean
): string {
  return `${tagPrefix}${semver.major}.${
    increment ? semver.minor + 1 : semver.minor
  }`;
}

export async function updateTag(
  tagName: string,
  sha: string | undefined
): Promise<void> {
  const octokit = getOctokitSingleton();

  core.debug(`Moving existing tag to new commit.`);
  await octokit.git.updateRef({
    ...context.repo,
    ref: `tags/${tagName}`,
    sha,
  });
}

export async function refExists(tagName: string): Promise<boolean> {
  try {
    const octokit = getOctokitSingleton();
    const ref = await octokit.git.getRef({
      ...context.repo,
      ref: `tags/${tagName}`,
    });
    return ref !== undefined;
  } catch (error) {
    return false;
  }
}

export function isReleaseBranch(): boolean {
  const releaseBranches = core.getInput("release_branches");
  const { GITHUB_REF } = process.env;
  const currentBranch = getBranchFromRef(GITHUB_REF);
  return releaseBranches
    .split(",")
    .some((branch) => currentBranch.match(branch));
}

export async function getSemanticVersion(tagPrefix: string): Promise<SemVer> {
  const prefixRegex = new RegExp(`^${tagPrefix}`);

  const validTags = await getValidTags(prefixRegex);
  const latestTag = getLatestTag(validTags, prefixRegex, tagPrefix);

  const semver = parse(latestTag.name.replace(prefixRegex, ""));
  semver.minorVersionTag = version.calculateMinorVersionTag(
    tagPrefix,
    semver,
    false
  );
  semver.majorVersionTag = version.calculateMajorVersionTag(tagPrefix, semver);
  return semver;
}
