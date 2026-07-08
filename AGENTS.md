# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Build

- Production build: `NODE_ENV=production ./node_modules/.bin/webpack --mode=production` (or `pnpm build`). Emits one bundle per page under `stage/appserver/static/pages/` (`stage/` is gitignored). Package manager is pnpm.

## SplunkUI dependency coupling

The `@splunk/*` frontend stack must move as one unit. `@splunk/react-page` pins `@splunk/react-ui` + `@splunk/themes` as runtime deps, so the app's own direct pins for `react-ui`, `themes`, `react-icons`, `ui-utils`, `splunk-utils` must match the versions `react-page` pulls - otherwise pnpm resolves two `react-ui` copies and theme/context breaks. After any bump, verify a single copy with `pnpm why @splunk/react-ui`.

- The stack stays on React 16 and styled-components 5: no published `@splunk/react-ui` accepts React 19, and `react-ui` still peers styled-components `^5.3.10`. React 16->18 and styled-components 6 are separate, independent efforts.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
