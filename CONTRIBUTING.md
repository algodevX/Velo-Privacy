# Contributing

Thanks for helping. A few conventions keep the codebase easy to reason about.

## Setup

```sh
npm install
npm run dev        # rebuild on change; reload the extension in the browser afterwards
npm run check      # must pass before a pull request
```

## Where code goes

- **Decisions are pure.** Anything that decides _what_ should happen (does this pattern
  match, which rule wins, which DNR rules express these settings) lives in `src/shared`
  and has unit tests. It must not call browser APIs.
- **Effects are confined.** Code that changes browser state lives in `src/background`.
  Modules own their slice of state and nothing else.
- **The UI edits settings.** Pages under `src/ui` write settings and let the background
  apply them. Add a message in `shared/messages.ts` only for actions that are not state.

## Adding a setting

1. Add the field, with a default and a doc comment, to `shared/settings/schema.ts`.
2. If it is a protection switch rather than a list or preference, add it to the presets.
3. Handle it in the owning module's `apply`, and list the section in `sections`.
4. Add a row for it to the relevant settings page, using the components in
   `src/ui/components`, with a one-sentence description of what the user gains or risks.
5. If it depends on an API not every browser has, gate it on `shared/platform.ts` in both
   the module and the settings page.
6. Cover the pure part with tests.

Changes that rename or reshape existing fields need a migration step in
`shared/settings/migrations.ts`.

## Adding a search engine

Add an entry to `SEARCH_ENGINES` in `shared/search/engines.ts`. Only map preferences onto
parameters you have verified on the live engine, and mark hosts as dedicated only if they
serve nothing but search. Add a test for the parameter mapping.

## Adding a filter list

Add an entry to `FILTER_LISTS` in `shared/adblock/catalog.ts` with the licence stated in
the list's header, and add it to the Credits section of the README. Only lists whose licence
allows redistribution can be bundled. Build once and check the counts in
`dist/chromium/filters/index.json`; the browser guarantees 30,000 rules across all enabled
rulesets, so a large list may need to stay off by default.

## User interface

The UI uses Material 3 components and tokens (`src/ui/styles`). Before adding something
new, look for the existing pattern: a switch row, a radio row, a segmented control, a
select, a site list with an _Add_ dialog, a feature tile, or a link row to a subpage. Keep to sentence
case, no trailing full stop on one-sentence descriptions, and icons from Material Symbols
(see `src/ui/icons.ts`). Check new screens in light and dark mode and at narrow widths.

## Style

- TypeScript strict mode; no `any`, and no non-null assertions to silence the compiler.
- Comments explain _why_, not _what_. Document browser quirks where they shape the code.
- UI text is short, plain and specific about consequences ("Sign-ins will not work"), and
  never mentions implementation details.
- Formatting is Prettier's; run `npm run format`.

## Commits and pull requests

Keep each pull request to one change, describe how you verified it and in which browsers,
and include screenshots for UI changes.

## Releases

Merging a pull request never publishes anything. A maintainer releases by opening
**Actions → Release → Run workflow** and entering the new version number. The workflow
sets the version, runs the checks, builds every browser, tags the commit and publishes a
GitHub release with the Chromium and Firefox zips, which are the files uploaded to the
browser stores.
