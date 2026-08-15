# Photo Dropper AI

## Overview

Photo Dropper AI is a web application that automatically integrates with a user's photo library (e.g. Google Photos, Pixiv) and intelligently picks the next photo the user want to see. Selection is based on display history, favorites, tags, and other signals. The goal is to make revisiting your library feel less like a chore and more like a curated feed.

## Features

### Integrations
- [x] Integrate with Google Photos API (OAuth via NextAuth, picker import, clear)
- [ ] Integrate with iCloud API
- [x] Integrate with Pixiv API (artwork import, bookmark import, high-res resolve, ugoira, multi-page, image proxy)

### Photo selection
- [x] Randomly pick photos from the library and display them (weighted random selection)
- [x] Store the last time the photo was displayed (`lastDisplayedAt`, `displayCount`)
- [x] Photos displayed most recently are shown less frequently (log-scaled recency weighting + display count penalty)

### Interactions
- [x] User can like/dislike photos
- [x] User can skip photos
- [x] User can favorite photos (favorited photos get a selection boost)
- [x] User can add tags to photos (with tag-based filtering)
- [x] User can add comments to photos (recorded as `COMMENT` interactions and rendered under each photo via `GET /api/photos/[id]/comments`)

### Search & discovery
- [x] Free-text search over title, description, tags, and artist
- [x] Filter photos by source and tags
- [ ] Extend to support other metadata based picking, e.g. location, date, etc.
    - [ ] User preferences
    - [ ] Current context
    - [ ] Review history (partial: recency + favorites are used; like/dislike signals are not yet fed back into ranking)
    - [ ] Other signals

### Infrastructure
- [x] NextAuth (Google) authentication
- [x] MongoDB via Mongoose (models Photo, User, Account, Interaction)
- [x] Seed endpoint for local development
- [x] Authenticated `userId` for interactions/imports — derived server-side from the NextAuth session via `getServerUserId()` (`src/lib/auth.ts`), with a stable `ANONYMOUS_USER_ID` fallback when not signed in. The client no longer sends `userId`; `/api/photos/interaction` ignores any `userId` in the request body.

## Tech Stack

- Pnpm
- Node.js (version 20+)
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- MongoDB via Mongoose
- NextAuth v4 (Google provider)
- Google Photos API
- Pixiv API (`pixiv-api-client`)

## Getting Started

> See `README_template.md` for the default `create-next-app` quickstart.

### Environment

Copy `.env.local` (or create one) with the credentials required by NextAuth, MongoDB, Google Photos, and Pixiv. The dev server reads it automatically.

### Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Jest tests |
| `pnpm test:watch` | Run Jest in watch mode |

## Architecture

- `src/app/` — Next.js App Router pages and API routes. API surface includes:
  - `api/photos/next` — weighted random photo selection (the core curation endpoint)
  - `api/photos/search` — free-text search with source/tag filters
  - `api/photos/[id]` — PATCH metadata (tags, description)
  - `api/photos/[id]/comments` — list comments for a photo (COMMENT interactions)
  - `api/photos/interaction` — record LIKE / DISLIKE / FAVORITE / SKIP / VIEW / COMMENT; `userId` is derived from the session, not the request body
  - `api/integrations/google/{picker,clear}` — Google Photos import
  - `api/integrations/pixiv/{artwork,bookmarks,resolve}` — Pixiv import and high-res resolution
  - `api/proxy/image` — server-side proxy for Pixiv images (hotlink protection)
  - `api/seed` — insert seed data
- `src/components/` — UI (PhotoViewer, Controls, FilterBar, MetadataEditor, SearchBar, integrations, UgoiraPlayer, AuthButton)
- `src/models/` — Mongoose models (Photo, User, Account, Interaction)
- `src/lib/` — auth, db, google photos / pixiv clients, storage
- `src/types/` — shared TypeScript types

### Selection algorithm

`api/photos/next` picks N photos via weighted random sampling:

1. Build a candidate pool: never-viewed photos first, then least-recently-viewed.
2. Weight each candidate:
   - Never viewed → `100`
   - Otherwise → `log2(hoursSinceViewed + 1) + 1`
   - Multiply by `1 / (1 + displayCount * 0.1)` so frequently viewed photos decay.
   - Multiply by `1.3` if the photo is favorited.
3. Sample without replacement.

## Known Gaps

- Read endpoints (`/api/photos/next`, `/search`, `/filters`) do not currently scope results by `userId`, so in a multi-user DB everyone sees every photo. Writes (imports, interactions) now attribute the correct `userId`; reads are still global.
- Like/dislike history is stored on the `Interaction` model but is not currently factored into photo ranking.
- iCloud is listed in the `Photo.source` enum but has no implementation.
- `README_template.md` has been left in place for reference; this README is the source of truth.

## License

Private project. Not configured for external distribution.