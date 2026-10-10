#!/usr/bin/env bash
# Prints the next semantic version (vX.Y.Z) for the commits in REF (default
# HEAD) that are not yet part of the latest release tag. Conventional commits:
#   "BREAKING CHANGE" in a body, or "type!:" subject  -> major
#   "feat:" / "feat(scope):"                           -> minor
#   anything else                                      -> patch
# The latest tag is taken globally (not via git describe) because release tags
# sit on prod merge commits, which are not ancestors of dev.
set -euo pipefail

ref="${1:-HEAD}"
last="$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n1)"

if [ -z "$last" ]; then
  base="0.0.0"
  range="$ref"
else
  base="${last#v}"
  range="$last..$ref"
fi

IFS=. read -r major minor patch <<<"$base"
log="$(git log --no-merges --format='%s%n%b' "$range")"

if grep -qE '^BREAKING[ -]CHANGE|^[a-z]+(\([^)]*\))?!:' <<<"$log"; then
  major=$((major + 1)); minor=0; patch=0
elif grep -qE '^feat(\([^)]*\))?:' <<<"$log"; then
  minor=$((minor + 1)); patch=0
else
  patch=$((patch + 1))
fi

echo "v${major}.${minor}.${patch}"
