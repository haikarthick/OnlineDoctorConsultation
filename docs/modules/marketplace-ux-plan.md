# Marketplace UX overhaul (started 2026-11-18)

Trigger: feedback from farmers/buyers/sellers - navigation and UI poor, not mobile friendly, posting
hard, photo/video handling weak, search/location/filters weak. Findings were verified against the code
(see the commit history of this file for the evidence list). The July 2026 work (security, deal flow,
chat, favorites, video) shipped; this plan is about structure and ease of use. Marketplace stays a
free classifieds module (no payments) - see memory `marketplace-gap-analysis-plan-2026-07-19`.

## Owner decisions (2026-11-18)
- Seller phone: tiered reveal. Masked number for everyone; full number on tap (Call / WhatsApp) for a
  signed-in buyer; every reveal logged and rate-limited; seller can see who viewed it. Chat stays.
- Location: state / district / pincode this phase. Map view is the NEXT phase.
- Media: up to 8 photos (3 recommended for animals), compressed on the phone to ~1600px; ONE video,
  45s recommended / 60s hard cap, compressed to ~720p, hard cap 50 MB; video encouraged not required;
  light moderation (existing animal review queue + report button + automated screening).
- Public (signed-out) browsing gets the same filters and near-me; sign-in only gates contacting a seller.
- Navigation: one set of destinations, shown per device. Phone = shared bottom tab bar; desktop = rail.
  Destinations: Browse, Sell, Messages, Me (My listings, Favorites, Saved searches, Deals, dashboard
  stats). Prices becomes a panel inside Browse and Sell. Admin stays in the admin area.
- `vercel-labs/ui` (UI SDK, beta, headless): NOT adopted. Revisit as a spike for one combobox/typeahead
  only if the filter/search work shows a real gap, and only behind the shared layer.

## Design contract (harness H10)
1. Sub-views: Browse (default) / Sell / Messages / Me. Me has sections. Browse filters live in a sheet.
2. Largest realistic data: 200+ listings (paged), 8 photos, 60-char Tamil title, 40 saved searches.
3. Phone vs desktop: 390px uses `BottomTabBar`, `BottomSheet` (filters), `ChipSelect`, `StepForm`;
   desktop shows filters in a side panel. New patterns go in `components/mobile/` or shared, not here.
4. Native controls: file inputs (camera/gallery) are triggered by a real `<label>`/input tap; covered by test.

## Phases and status
| # | Phase | Status |
|---|---|---|
| 0 | Decisions + design contract (this file) | done |
| 1 | Navigation + shell (Browse/Sell/Messages/Me), language fixes, video-reset bug | done 2026-11-18 |
| 2 | Buyer discovery: filters sheet, state/district/pincode, place + distance on cards, public page too | done 2026-11-18 (search still uses the English text config - see below) |
| 3 | Photos + video: 8 photos compressed on the phone, camera capture, video-first gallery | done 2026-11-18 (video NOT transcoded on the device - see below) |
| 4 | Easy posting: photo-first flow, draft autosave, phone prefill, My listings (edit / mark sold / delete) | done 2026-11-18 (no renew/pause: listings do not expire by default) |
| 5 | Contact: masked phone, reveal on Call/WhatsApp tap (logged, 30/day, seller notified, who-viewed) | done 2026-11-18 (buyer phone verification not required - it only exists for farm-invite sign-ups) |
| 6 | Quality gates: component tests (filters, My listings, gallery, photo step), media + SQL unit tests | done 2026-11-18 |

## Follow-up round (2026-11-18, same day) - open items closed
- **Search in Indian languages - done.** Search also matches description, place, district and state. The app maps typed Hindi/Tamil/Telugu/Kannada/Malayalam breed and species names to the canonical names stored on listings (`utils/searchAliases.ts`, from the locale files and any admin-typed names) and sends them as `searchAliases`; the server matches them exactly (bound parameter, max 10). Limit: only breeds/species the app has a translation for are understood; free words inside a description are still matched by plain substring, not by language-aware stemming. No pg_trgm/unaccent index was added (an extension that cannot be created would abort init.sql, which is one transaction).
- **Video compression on the phone - done, UNTESTED ON A DEVICE.** `utils/videoCompress.ts` re-records a large video at 720p/1.5 Mbps in the browser (plays once in real time; progress shown). Falls back to the original when the browser cannot (no MediaRecorder/captureStream) or anything fails. Needs a real-phone test (Chrome Android, Safari iOS).
- **Public near-me and distance - done** (shared `hooks/useNearMe.ts` + `NearMeBar`).
- **Map view - done** (list/map toggle on both pages, reuses `components/MapView`, lazy-loaded). Pins are rounded to ~1 km. PRIVACY FIX in the same change: exact seller coordinates were previously returned to every signed-in user; now only the seller/admin get them.
- **Automated photo screening - hook only, OFF by default.** Set `MEDIA_MODERATION` (a Cloudinary moderation add-on, e.g. aws_rek) to screen marketplace PHOTOS at upload; a rejected photo is deleted and the person gets a plain message. Never applied to medical photos. Not verified against a live add-on (needs an account/add-on). Video screening is asynchronous at Cloudinary and is NOT handled: videos still rely on the report button and the review queue.
- **Harness:** runtime-verify PHASE 6d drives the marketplace on the real schema; it now refuses to run against a backend/dist older than backend/src.

## Still open
- Manual check by the owner on a real Android phone over mobile data: take a photo, record a video (watch the 'making the video smaller' progress), confirm Call/WhatsApp open the right app, confirm the map pins show.
- Video moderation (asynchronous) and enabling `MEDIA_MODERATION` in an environment that has the add-on.
- OpenStreetMap's public tile server is used for the map; its usage policy discourages heavy traffic. If the marketplace map gets real volume, switch the tile URL in `components/MapView.tsx` to a paid/own tile provider.

Each phase: tsc + lint + vitest + build, runtime verify for DB/route changes, then commit and push to
origin/develop. Manual functional checks needed from the owner are listed at the end of each phase.
