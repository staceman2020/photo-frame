# Photo Frame — Features

Feature definitions with acceptance criteria. Cross-references:
[ARCHITECTURE.md](ARCHITECTURE.md). Priority: **P1** = core, must exist for the
app to be useful; **P2** = complete product; **P3** = nice-to-have.

---

## F1. Account & device access (P1)

Single-owner web app reachable from any device.

- Sign-in with the owner's Firebase account; all other accounts are rejected
  by security rules.
- First run: generate the master key, show the recovery code, require the user
  to confirm they have stored it before continuing (typed confirmation of a
  code fragment).
- New device: paste recovery code once → verified against the key-check token
  → stored per ARCHITECTURE §4.1.
- **Lock** button and configurable auto-lock timer wipe the key and all
  decrypted data from the browser.
- Settings can re-display the recovery code while unlocked.

## F2. Client-side encryption (P1)

- Every photo blob (original, display, thumbnail) is AES-256-GCM encrypted in
  the browser before upload; plaintext image bytes never leave the device.
- Decryption failures (tamper/corruption) surface as a broken-photo state, not
  a crash.
- All encryption/decryption runs off the main thread (Web Worker).

## F3. Upload pipeline (P1)

Multi-file upload with in-browser analysis.

- Drag-and-drop or file-picker, many files at once.
- Per file, in the browser: verify the file actually decodes as an image;
  extract width/height; classify portrait / landscape / square; compute a
  SHA-256 fingerprint.
- Duplicate fingerprints are skipped, never re-uploaded, and reported in the
  results ("3 duplicates skipped").
- Non-images are rejected with a per-file reason.
- Display (~2560px) and thumbnail (~400px) derivatives generated client-side,
  encrypted, and uploaded alongside the original.
- Progress UI: per-file state (queued / processing / uploading / done /
  duplicate / rejected / failed) with retry for failures.
- Uploads can be marked secure at upload time (default: current mode's
  visibility — secure when uploading in secure mode).

## F4. Library grid (P1)

- Virtualised thumbnail grid of all visible photos (mode-aware), sorted by
  upload or capture date.
- Multi-select with bulk actions: add/remove tags, toggle secure flag
  (secure-mode only), delete (with confirm; removes Firestore doc + all blobs).
- Filter bar: apply any saved filter (F8) or ad-hoc tag include/exclude, plus
  a tagged/untagged toggle.
- Click opens the lightbox (F7) at that photo.

## F5. Secure / open mode (P1)

- App starts in open mode. Entering secure mode prompts for the secure PIN
  (set during onboarding; changeable in settings while in secure mode).
- Open mode: secure photos and secure tags are invisible everywhere — grid,
  lightbox, search, tag pickers, filters, slideshows, counts.
- Secure mode: everything is visible; secure items carry a visual badge.
- Explicit "leave secure mode" control, plus automatic exit on lock and after
  a configurable inactivity period.
- Toggling a photo's or tag's secure flag is only possible in secure mode.
- A slideshow launched in open mode never shows secure photos, even if secure
  mode is entered on another tab/device meanwhile.

## F6. Tags & tag implications (P1)

- Create/rename/recolor/delete tags; deleting removes the tag from all photos
  after a confirm showing usage count.
- A tag can be marked **secure**: its name and its assignments are invisible
  in open mode, even on visible photos.
- **Implications:** a tag can imply one or more other tags (e.g. Forest →
  Nature). Implications are transitive (Forest → Nature → Outdoors). Applying
  a tag applies its full implication closure to the photo's effective tags;
  explicit vs implied is visually distinguished in the UI.
- Editing implication rules re-expands affected photos in a background batch
  with a progress indicator.
- Guardrails: cycle warning; an open tag cannot imply a secure tag
  (ARCHITECTURE §6.4).

## F7. Lightbox with rapid tagging (P1)

The core curation workflow.

- Fullscreen-ish single-photo view over the current filtered set, with
  next/previous (buttons, arrow keys, swipe).
- Entry filters include **tagged / untagged / all**, so "work through
  everything I haven't tagged yet" is one click.
- Always-visible tag panel: type-ahead tag input, recent-tags one-click chips,
  and number-key shortcuts bound to the most-used tags.
- **Tag-and-advance:** committing a tag can optionally auto-advance to the
  next photo (toggle), enabling a keep-hands-on-keyboard triage loop.
- Also from here: toggle secure flag (secure mode only), rotate metadata
  orientation, delete.

## F8. Saved filters (P1)

- A filter = include-tags (match **any** or **all**) + exclude-tags
  (match **none**), per ARCHITECTURE §6.3.
- Builder UI with live match count and result preview grid.
- Filters are named, saved, editable, deletable; usable in the library,
  lightbox, and slideshow.
- A filter referencing secure tags is itself treated as secure (hidden in open
  mode); in open mode any filter evaluates over open photos only.

## F9. Layout designer (P2)

- Canvas representing the screen (16:9 default, other ratios selectable).
- Add, drag, resize, and delete rectangles until the screen is filled; snapping
  and edge-alignment guides; overlap warning; a "fill remaining space" helper.
- Slots stored as normalised (0–1) coordinates so a layout works on any
  resolution.
- Optional per-slot orientation preference (portrait/landscape/square/any)
  that the slideshow uses when assigning photos.
- Layouts are named, saved, duplicated, deleted; preview with placeholder
  images.

## F10. Fullscreen slideshow ("photo frame") (P2)

- Start = choose a layout (F9) + a filter (F8) + timing; enters browser
  fullscreen with wake-lock.
- Each slot independently replaces its photo after a **random dwell time
  uniformly drawn between the user's min and max seconds**, re-drawn every
  cycle, with jittered starts — slots never change in unison.
- Replacements **cross-fade** (~1s opacity fade); the incoming image is
  decrypted and decoded before the fade begins, so there is no flash or
  pop-in.
- Photos are drawn from the filtered set, shuffled, cycling so everything is
  shown before repeats; slot orientation preferences respected when possible.
- **Edge settings panel:** moving the mouse to the left edge slides in a panel
  with min/max dwell-time controls (applied live), pause/resume, and exit.
  Panel hides when the pointer leaves; cursor auto-hides during playback.
- **Pause + tag:** while paused, clicking a photo opens its tag editor in an
  overlay; closing it resumes where it left off.
- Mode-aware: honours the mode it was launched in (F5).

## F11. Settings (P2)

- Secure PIN set/change (in secure mode), auto-lock timer, secure-mode
  inactivity timeout, slideshow defaults (min/max dwell, fade duration),
  recovery-code re-display.
- Storage usage readout (photo count, total bytes).

## F12. Backup & export (P2)

The answer to "what if Firebase/my account goes away" (ARCHITECTURE §7.4).

- Export-all: downloads every original **decrypted** into a zip (chunked, with
  progress), plus a JSON dump of all metadata (tags, implications, layouts,
  filters). Runs only while unlocked; secure items included only when in
  secure mode.
- Single-photo download (decrypted original) from lightbox and grid.

## F13. Consistency sweep (P3)

- Maintenance action in settings: detects and reports orphaned Storage blobs
  (interrupted uploads), photo docs with missing blobs, and photos whose
  `effectiveTagIds` are stale relative to current implication rules; offers
  one-click repair.

## F14. Multi-device sync (P3 — mostly free)

- Firestore real-time listeners keep tags, photos, filters, and layouts live
  across open devices; a slideshow picks up newly uploaded matching photos on
  its next cycle without restart.

---

## Requirement → feature map

| # | Original requirement | Feature(s) |
|---|---|---|
| 1 | Single web repository, multi-device | F1, F14 |
| 2 | Client-side encryption, key in localStorage, risks discussed | F2, F1 · ARCHITECTURE §4, §7.1 |
| 3 | Secure / open mode | F5 |
| 4 | Tags, secure tags | F6 |
| 5 | Lightbox with quick tagging & tagged/untagged filter | F7 |
| 6 | Screen layout designer | F9 |
| 7 | Include/exclude tag filters | F8 |
| 8 | Fullscreen slideshow: fades, edge panel, pause, tag-edit, randomised min–max timing | F10 |
| 9 | Multi-upload: validation, orientation, dimensions, fingerprint dedupe | F3 |
| 10 | Tag implications | F6 |
| 11 | TS / Antd / React / Firebase / Zustand / Vite | ARCHITECTURE §2, §8 |

## Suggested build order

1. **Walking skeleton:** F1 (auth + key) → F2 (crypto service) → F3 (upload) →
   F4 (grid). At this point photos round-trip encrypted.
2. **Curation:** F6 (tags + implications) → F7 (lightbox) → F8 (filters) → F5
   (secure mode — added once selectors exist, so mode-awareness lands in one
   layer).
3. **Display:** F9 (layouts) → F10 (slideshow).
4. **Hardening:** F11, F12, F13.
