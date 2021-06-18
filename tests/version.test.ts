import * as version from "../src/version";
import * as github from "githubtag/lib/github";
import * as utils from "githubtag/lib/utils";
import * as core from "@actions/core";
import semver from "semver";
// @ts-ignore
import yaml from "js-yaml";
import fs from "fs";
import path from "path";

const SHA = "79e0ea271c26aa152beef77c3275ff7b8f8d8274";

jest.spyOn(core, "debug").mockImplementation(() => {});
jest.spyOn(core, "info").mockImplementation(() => {});
jest.spyOn(console, "info").mockImplementation(() => {});

describe("isReleaseBranch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCommitSha(SHA);
    loadDefaultInputs();
  });

  it("matches any named release branch", async () => {
    // Given
    setInput("release_branches", "master,main,blah");

    // When/Then
    setBranch("refs/heads/master");
    expect(version.isReleaseBranch()).toBe(true);
    // When/Then
    setBranch("refs/heads/main");
    expect(version.isReleaseBranch()).toBe(true);
    // When/Then
    setBranch("refs/heads/blah");
    expect(version.isReleaseBranch()).toBe(true);
    // When/Then
    setBranch("master");
    expect(version.isReleaseBranch()).toBe(true);
  });

  it("does not match a non release branch", async () => {
    // Given
    setInput("release_branches", "master,main,blah");

    // When/Then
    setBranch("refs/heads/fred");
    expect(version.isReleaseBranch()).toBe(false);
    // When/Then
    setBranch("asd");
    expect(version.isReleaseBranch()).toBe(false);
  });
});

describe("calculateMajorVersionTag", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCommitSha(SHA);
    loadDefaultInputs();
  });

  it("calculates correct major version", async () => {
    expect(
      version.calculateMajorVersionTag("v", {
        major: 2,
        minor: 5,
        patch: 10,
      } as semver.SemVer)
    ).toBe("v2");
    expect(
      version.calculateMajorVersionTag("blah", {
        major: 9,
        minor: 5,
        patch: 10,
      } as semver.SemVer)
    ).toBe("blah9");
  });
});

describe("calculateMinorVersionTag", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCommitSha(SHA);
    loadDefaultInputs();
  });

  it("calculates correct major version", async () => {
    expect(
      version.calculateMinorVersionTag(
        "v",
        {
          major: 2,
          minor: 5,
          patch: 10,
        } as semver.SemVer,
        false
      )
    ).toBe("v2.5");
    expect(
      version.calculateMinorVersionTag(
        "blah",
        {
          major: 9,
          minor: 71,
          patch: 10,
        } as semver.SemVer,
        false
      )
    ).toBe("blah9.71");
    expect(
      version.calculateMinorVersionTag(
        "blah",
        {
          major: 4,
          minor: 21,
          patch: 3,
        } as semver.SemVer,
        true
      )
    ).toBe("blah4.22");
  });
});

describe("getSemanticVersion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setBranch("master");
    setCommitSha(SHA);
    loadDefaultInputs();
  });

  it("set tags on semver", async () => {
    // Given
    jest.spyOn(utils, "getValidTags").mockImplementation(async () => []);
    jest.spyOn(utils, "getLatestTag").mockReturnValue({ name: "v2.5.3" });
    const parseMock = jest
      .spyOn(semver, "parse")
      .mockReturnValue({ major: 2, minor: 5, patch: 3 } as semver.SemVer);

    // When
    const result = await version.getSemanticVersion("v");

    // Then
    expect(parseMock).toBeCalledWith("2.5.3");
    expect(result.minorVersionTag).toBe("v2.5");
    expect(result.majorVersionTag).toBe("v2");
  });
});

describe("tagVersion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setBranch("master");
    setCommitSha(SHA);
    loadDefaultInputs();
  });

  it("creates new tag if ref does not exist", async () => {
    // Given
    jest.spyOn(version, "refExists").mockImplementation(async () => false);
    const createTagMock = jest
      .spyOn(github, "createTag")
      .mockImplementation(async () => {});

    // When
    await version.tagVersion("v1", true, SHA);

    // Then
    expect(createTagMock).toBeCalledWith("v1", true, SHA);
  });

  it("updates tag if ref does exist", async () => {
    // Given
    jest.spyOn(version, "refExists").mockImplementation(async () => true);
    const updateTagMock = jest
      .spyOn(version, "updateTag")
      .mockImplementation(async () => {});

    // When
    await version.tagVersion("v2", true, SHA);

    // Then
    expect(updateTagMock).toBeCalledWith("v2", SHA);
  });
});

describe("applyAdditionalTags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setBranch("master");
    setCommitSha(SHA);
    loadDefaultInputs();
  });

  it("doesnt run if not in a release branch", async () => {
    // Given
    jest.spyOn(version, "isReleaseBranch").mockReturnValue(false);
    const getSemVerSpy = jest.spyOn(version, "getSemanticVersion");

    // When
    await version.applyAdditionalTags();

    // Then
    expect(getSemVerSpy).not.toBeCalled();
  });

  it("tags major and minor if in a release branch", async () => {
    // Given
    jest.spyOn(version, "isReleaseBranch").mockReturnValue(true);
    jest
      .spyOn(version, "getSemanticVersion")
      .mockReturnValueOnce(createSemVer(1, 2, 3, "v"));
    const tagVersionMock = jest
      .spyOn(version, "tagVersion")
      .mockResolvedValue();

    // When
    await version.applyAdditionalTags();

    // Then
    expect(tagVersionMock).toBeCalledWith("v1.2", true, SHA);
    expect(tagVersionMock).toBeCalledWith("v1", true, SHA);
  });
});

function setBranch(branch: string) {
  process.env["GITHUB_REF"] = `refs/heads/${branch}`;
}

function setCommitSha(sha: string) {
  process.env["GITHUB_SHA"] = sha;
}

function setInput(key: string, value: string) {
  process.env[`INPUT_${key.toUpperCase()}`] = value;
}

function setInputs(map: { [key: string]: string }) {
  Object.keys(map).forEach((key) => setInput(key, map[key]));
}

function loadDefaultInputs() {
  const actionYaml = fs.readFileSync(
    path.join(process.cwd(), "action.yml"),
    "utf-8"
  );
  const actionJson = yaml.safeLoad(actionYaml) as {
    inputs: { [key: string]: { default?: string } };
  };
  const defaultInputs = Object.keys(actionJson["inputs"])
    .filter((key) => actionJson["inputs"][key].default)
    .reduce(
      (obj, key) => ({ ...obj, [key]: actionJson["inputs"][key].default }),
      {}
    );
  setInputs(defaultInputs);
}
async function createSemVer(
  major: number,
  minor: number,
  patch: number,
  prefix: string
): Promise<semver.SemVer> {
  return {
    major,
    minor,
    patch,
    minorVersionTag: `${prefix}${major}.${minor}`,
    majorVersionTag: `${prefix}${major}`,
  };
}
