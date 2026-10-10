# Changelog

User-visible changes to the bookkeeping app. Format:
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions match the
`vX.Y.Z` release tags.

When merging a release PR, move the `Unreleased` entries under the new version.
The GitHub Release lists every commit; this file keeps only what users notice.

## [Unreleased]

### Added

- The profile menu (bottom of the sidebar) shows the deployed version.

### Security

- Notes and Services Provided are cleaned of scripts, event handlers and
  unsafe links, both when saved and when displayed. Formatting made with the
  editor (bold, italic, underline, lists, line breaks) is kept.

### Changed

- The app is served from a single address: the screens and the API now run in
  one container. The first page load after a quiet period can take a few
  seconds while the app starts.
