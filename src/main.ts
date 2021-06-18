import * as core from "@actions/core";
import githubtag from "githubtag/lib/action";
import * as version from "./version";

async function run(): Promise<void> {
  try {
    await githubtag();

    await version.applyAdditionalTags();
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
