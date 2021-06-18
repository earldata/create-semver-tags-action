# create-semver-tags-action
A GitHub action that extends the functionality of https://github.com/mathieudutour/github-tag-action to add or move additional tags on release branches.

For example:

If the calculated semver is 1.2.3 then the following tags will be generated: v1.2.3, v1.2, v1.

If there is an existing v1 or v1.2 tag then it will move it the current git sha.

If it is a non-release branch and the calculated tag is v1.2.3-feature-branch.0 for example then the additional v1.2, v1 tags will not be generated.
