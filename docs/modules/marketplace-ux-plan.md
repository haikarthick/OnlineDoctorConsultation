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

## Open items (not done, owner to prioritise)
- Search: full-text still uses the English configuration; Hindi/Tamil/Telugu/Kannada/Malayalam queries and transliterated breed names match poorly. Needs unaccent/trigram + localized labels in the index.
- Video: not compressed or transcoded on the phone (needs an in-browser encoder). Protection today is the 50 MB / 60 s cap plus Cloudinary q_auto on delivery.
- Public page: no near-me / distance (needs the same geolocation control as the signed-in page).
- Map view: next phase, by owner decision.
- Video moderation: only the existing animal review queue + report button; no automated screening yet.
- Manual check needed by the owner: take a photo and record a video on a real Android phone over mobile data; confirm Call and WhatsApp open the right app.

Each phase: tsc + lint + vitest + build, runtime verify for DB/route changes, then commit and push to
origin/develop. Manual functional checks needed from the owner are listed at the end of each phase.
