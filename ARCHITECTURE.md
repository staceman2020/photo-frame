# Photo Frame — Architecture Definition

A private, single-user, encrypted photo repository and display system. Photos are
encrypted in the browser before upload, organised with tags, and presented through
user-designed fullscreen slideshow layouts.

## 1. Goals and non-goals

### Goals

- One web application usable from any of the owner's devices.
- Photo **bytes are never stored or transmitted in plaintext** — encryption and
  decryption happen exclusively in the browser.
- A casual-privacy "secure mode" that hides designated photos and tags from
  house guests.
- Tag-driven organisation, a rapid-tagging lightbox, user-designed layouts,
  include/exclude filters, and a randomised fullscreen slideshow ("photo frame"
  mode).
- Client-side validation, dimension/orientation detection, and fingerprint-based
  duplicate prevention on upload.

### Non-goals

- Multi-user sharing or collaboration (single Firebase account, the owner's).
- Protection of secure-mode content against a *technically skilled* adversary
  with device access (see §7.3 — secure mode is a curtain, not a safe).
- Encryption of metadata (tags, dimensions, fingerprints). Metadata is plaintext
  in Firestore, protected only by Firebase Authentication and security rules.
- Video support.

## 2. Technology stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| UI framework | React 18+ |
| Component library | Ant Design (Antd) 5 |
| State management | Zustand |
| Build tool | Vite |
| Auth | Firebase Authentication (single allowed account) |
| Metadata store | Cloud Firestore |
| Encrypted blob store | Firebase Cloud Storage |
| Hosting | Firebase Hosting |
| Cryptography | Web Crypto API (`crypto.subtle`), AES-256-GCM |
| Image processing | Browser-native (`createImageBitmap`, `OffscreenCanvas`), in a Web Worker |

Firebase requires the **Blaze (pay-as-you-go) plan** for Cloud Storage. At
single-user scale (<10k photos) expect costs of a few dollars per month,
dominated by storage volume and slideshow download bandwidth (mitigated by
encrypted display-size derivatives, §5.2).

## 3. System overview

```
┌────────────────────────────── Browser ──────────────────────────────┐
│                                                                     │
│  React + Antd UI                                                    │
│    ├─ Library / Lightbox / Layout designer / Slideshow / Settings   │
│    │                                                                │
│  Zustand stores (auth, key, mode, photos, tags, layouts, filters,   │
│                  slideshow)                                         │
│    │                                                                │
│  Service layer                                                      │
│    ├─ CryptoService        (key mgmt, AES-GCM encrypt/decrypt)      │
│    ├─ UploadService        (validate → fingerprint → dedupe →       │
│    │                        derivatives → encrypt → upload)         │
│    ├─ PhotoService         (Firestore CRUD, tag expansion)          │
│    ├─ BlobCache            (decrypted object-URL LRU cache)         │
│    └─ Web Worker           (hashing, image decode/resize,           │
│                             encrypt/decrypt off the main thread)    │
└──────────────┬───────────────────────────────┬──────────────────────┘
               │ plaintext metadata            │ ciphertext only
               ▼                               ▼
        Cloud Firestore                 Firebase Cloud Storage
   (photos, tags, layouts,          (originals + derivatives,
    filters, settings docs)          all AES-256-GCM encrypted)
```

**Nothing but ciphertext ever reaches Cloud Storage.** Firestore holds only
metadata the owner accepted as plaintext: tags, dimensions, orientation,
fingerprint hash, timestamps, and the per-photo secure flag.

There is no server-side application code. Firebase security rules restrict all
reads and writes to the owner's authenticated UID. Cloud Functions are not
required for v1; a periodic client-side "consistency sweep" (orphaned blobs,
missing derivatives) replaces server jobs.

## 4. Cryptography design

### 4.1 Master key

- A single random **256-bit AES key**, generated in-browser with
  `crypto.getRandomValues` during first-run setup.
- Presented to the user once as a **recovery code** (BIP39-style word list
  and/or downloadable key file) with an explicit "if you lose this, your photos
  are gone forever" acknowledgement step.
- On each new device the user pastes the recovery code once; the app verifies it
  by decrypting a stored **key-check token** (a known plaintext encrypted at
  setup time, stored in Firestore) before accepting it.
- Stored in the browser's `localStorage` after entry (per product requirement —
  risks in §7.1, with recommended hardening).

### 4.2 Encryption scheme

- **AES-256-GCM** via Web Crypto, one random 96-bit IV per blob, IV prepended to
  the ciphertext. GCM provides integrity: a tampered or corrupted blob fails to
  decrypt rather than rendering garbage.
- Each stored object (original, display derivative, thumbnail) is encrypted
  independently so any one can be fetched and decrypted alone.
- Encrypt/decrypt runs in a Web Worker to keep the UI responsive during batch
  uploads and slideshows.
- Decrypted images exist only as in-memory `Blob`s exposed through
  `URL.createObjectURL`; they are never written to `localStorage`, IndexedDB, or
  the Cache API. The BlobCache holds a bounded LRU set and revokes object URLs
  on eviction and on lock.

### 4.3 Locking

- **Lock** action (and optional auto-lock timer): wipes the key from
  localStorage and memory, revokes all object URLs, returns to the key-entry
  screen. This is the recommended remedy when a device is shared or suspect.

## 5. Data model

### 5.1 Firestore collections

All documents live under `users/{ownerUid}/…`; security rules deny any other UID.

```
users/{uid}
  meta/keyCheck            { ciphertext, iv, createdAt }
  meta/settings            { securePinHash, securePinSalt, slideshowDefaults,
                             autoLockMinutes }
  photos/{photoId}         { fingerprint,            // SHA-256 hex of original bytes
                             fileName, mimeType, bytes,
                             width, height, orientation,   // 'portrait'|'landscape'|'square'
                             secure: boolean,
                             tagIds: string[],        // explicit tags
                             effectiveTagIds: string[], // explicit + implied (denormalised)
                             storagePaths: { original, display, thumb },
                             createdAt, uploadedAt }
  tags/{tagId}             { name, color, secure: boolean,
                             impliesTagIds: string[] }
  layouts/{layoutId}       { name,
                             slots: [{ id, x, y, w, h }] }   // normalised 0..1 coords
  filters/{filterId}       { name,
                             includeTagIds: string[],  // photo must match (see mode)
                             includeMode: 'any'|'all',
                             excludeTagIds: string[] } // photo must match none
```

Notes:

- `photoId` **is the fingerprint** (SHA-256 of the original file bytes). This
  makes duplicate detection a simple existence check and is race-free even
  across concurrent uploads from two devices.
- `effectiveTagIds` denormalises the transitive closure of tag implications so
  Firestore `array-contains` queries and client-side filtering stay trivial.
  When implication rules change, the client runs a batch re-expansion over
  affected photos (§6.4).
- `secure` on a photo hides it in open mode. `secure` on a tag hides the tag
  itself (its name and its presence on any photo) in open mode. A secure photo
  may carry open tags; they remain invisible because the photo is.

### 5.2 Cloud Storage layout

```
users/{uid}/photos/{photoId}/original.bin    // encrypted original
users/{uid}/photos/{photoId}/display.bin     // encrypted ~2560px long-edge JPEG/WebP
users/{uid}/photos/{photoId}/thumb.bin       // encrypted ~400px long-edge
```

Derivatives are generated **in the browser before encryption** (server-side
resizing is impossible — the server never sees plaintext). Thumbnails feed the
library grid and lightbox filmstrip; the display derivative feeds the lightbox
and slideshow; the original is fetched only for download/export.

## 6. Key mechanisms

### 6.1 Upload pipeline (browser, Web Worker)

1. User drops N files.
2. Per file: verify it decodes as an image (`createImageBitmap`) — actual
   decodability, not just MIME/extension. Reject non-photos with a reason.
3. Read dimensions → derive orientation (portrait / landscape / square, with a
   small tolerance band for "square").
4. Compute SHA-256 fingerprint of the raw bytes.
5. Check `photos/{fingerprint}` existence → skip duplicates, report them.
6. Generate display + thumb derivatives on `OffscreenCanvas`.
7. Encrypt original, display, thumb (independent IVs).
8. Upload the three blobs, then write the Firestore photo document last
   (document existence = upload complete; the consistency sweep collects
   stragglers from interrupted uploads).
9. Progress UI with per-file status: uploaded / duplicate / rejected / failed.

### 6.2 Secure vs open mode

- The app boots in **open mode**. Entering secure mode requires the secure PIN;
  the PIN's salted hash lives in `meta/settings` and verification is
  client-side.
- Mode lives in the Zustand `mode` store and gates **every** photo and tag
  selector: open mode filters out `secure` photos and `secure` tags at the
  selector layer, so no view, search, filter, lightbox, or slideshow can leak
  them by accident. Slideshows started in open mode stay open even if the mode
  changes behind them.
- Secure mode exits explicitly, on lock, and on an inactivity timeout.
- This is an **application-level curtain, not cryptographic protection** — see
  §7.3.

### 6.3 Filtering model

A filter = `(includeTagIds, includeMode, excludeTagIds)` evaluated against
`effectiveTagIds`:

```
matches(photo) =
      (includeTagIds empty
        OR (includeMode = 'any' AND photo has ≥1 of includeTagIds)
        OR (includeMode = 'all' AND photo has every includeTagId))
  AND (photo has none of excludeTagIds)
  AND (mode = open ⇒ photo.secure = false)
```

At <10k photos the full metadata set loads into the Zustand store (with a
Firestore listener for cross-device sync) and filters evaluate client-side —
no composite-index gymnastics needed.

### 6.4 Tag implications

- Tags form a directed graph via `impliesTagIds`. The client computes the
  transitive closure; cycles are tolerated (closure of a cycle is well-defined)
  but the UI warns when creating one.
- Applying a tag to a photo writes the explicit tag to `tagIds` and the
  expansion to `effectiveTagIds`.
- Editing implication rules triggers a client-side batch job that recomputes
  `effectiveTagIds` for every photo carrying an affected tag (chunked Firestore
  batch writes, progress bar).
- Implication crossing the secure boundary is constrained: a **secure tag may
  not imply an open tag's visibility problems in reverse** — specifically, an
  open tag must never imply a secure tag (that would silently attach hidden
  metadata in open mode); the UI blocks this combination.

### 6.5 Slideshow engine

- Input: one layout + one filter (+ min/max display seconds).
- Matching photos are shuffled into a queue per slot, preferring
  orientation-compatible photos for each slot's aspect ratio when possible.
- Each slot runs an **independent timer**: `delay = random(min, max)` drawn
  fresh for every replacement, so slots naturally de-synchronise. Initial
  delays are also jittered so slots never start in lockstep.
- Replacement = CSS opacity cross-fade between two stacked `<img>` layers per
  slot; the incoming image is fetched, decrypted, and fully decoded **before**
  the fade starts (no pop-in).
- Prefetch: each slot decrypts its next photo during the current photo's dwell
  time; the BlobCache bounds memory.
- Settings panel: hidden, slides in when the pointer enters the left ~24px edge
  zone; contains min/max timing controls, pause/resume, and exit. Clicking a
  photo while paused opens the tag editor for that photo in place.
- Uses the Fullscreen API; a wake-lock (`navigator.wakeLock`) keeps display
  devices awake.

## 7. Security analysis and risks

### 7.1 Master key in `localStorage` (accepted product requirement)

Storing the key in `localStorage` trades security for the convenience of
entering it once per device. The risks, honestly stated:

1. **XSS is total compromise.** Any script that executes in the app's origin
   can read `localStorage` and exfiltrate the key, permanently compromising
   every photo. This is the dominant risk. Mitigations: a strict Content
   Security Policy (no inline scripts, no third-party script origins), zero
   third-party runtime scripts (no analytics, no CDN-loaded libraries — bundle
   everything via Vite), React's default escaping, no
   `dangerouslySetInnerHTML`, and dependency auditing/lockfiles because a
   compromised npm package ships straight into the bundle.
2. **Anyone at the unlocked browser profile has the key.** A household member
   or thief using the same OS account can open dev tools and read it — or more
   simply, just use the app. Mitigations: OS-level user accounts and disk
   encryption; the app's lock action and auto-lock timer (§4.3) for shared or
   at-risk devices.
3. **Malicious browser extensions** with page access can read `localStorage`.
   Out of the app's control; keep the browser profile clean.
4. **Disk backups and forensic copies** of the browser profile include
   `localStorage`. Browsers do not sync `localStorage` across devices, but a
   Time Machine/imaging backup of the profile directory captures the key in
   plaintext on the backup medium.
5. **No expiry.** The key persists until explicitly cleared.

**Hardening options (recommended, still honouring "enter once"):**

- Store the key as a **non-extractable `CryptoKey` in IndexedDB** instead of a
  hex string in `localStorage`. Scripts (including injected ones) can *use*
  the key while the app is open but cannot read its raw bytes out, which
  defeats simple exfiltration; an attacker would have to pull ciphertexts and
  decrypt them via the live page, a much noisier attack. The user experience
  is identical.
- Optional "require secure PIN on startup" toggle that wraps the stored key
  with a PIN-derived key, so a bare copy of the browser profile is not enough.

The architecture treats the localStorage decision as replaceable: all key
access goes through `CryptoService`, so upgrading the storage mechanism later
touches one module.

### 7.2 What the server can and cannot see

- **Cannot see:** photo pixels, at any size — only AES-GCM ciphertext.
- **Can see:** everything in Firestore — tag names (including secure tags'
  names), photo counts, dimensions, orientations, fingerprints, upload times,
  and the structure of layouts/filters. Anyone who compromises the Firebase
  account (or Google, or a subpoena) learns the *shape* of the library but not
  its content. Choose tag names accordingly.

### 7.3 Secure mode is not cryptographic

By explicit decision, secure mode is a PIN-gated UI filter over a shared key.
Consequences:

- A technical visitor with access to an unlocked device can bypass it via dev
  tools (the key decrypts everything, and secure photos' metadata is readable
  in Firestore).
- The PIN protects against casual browsing only. For genuinely sensitive
  material, the correct defence is the **lock** action before handing the
  device over, which removes the key entirely.
- The one hard guarantee the app *does* make: secure photos and secure tags are
  excluded at the data-selector layer, so no legitimate UI path (search,
  slideshow, filter, autocomplete) reveals them in open mode.

### 7.4 Availability / durability risks

- **Key loss = total data loss.** No recovery path exists by design. The
  first-run flow forces recovery-code acknowledgement; the settings screen
  allows re-displaying the recovery code while unlocked.
- **Firebase account loss** (Google account compromise/closure) loses the
  ciphertext. An encrypted-export feature (download all originals as stored,
  i.e., still encrypted, plus a metadata dump) is specified in FEATURES.md as
  the backup story.

## 8. Frontend structure

```
src/
  app/            routing, providers, theme (Antd ConfigProvider)
  stores/         zustand: useAuthStore, useKeyStore, useModeStore,
                  usePhotoStore, useTagStore, useLayoutStore,
                  useFilterStore, useSlideshowStore
  services/       cryptoService, uploadService, photoService, tagService,
                  blobCache, firestore/storage adapters
  workers/        imageWorker.ts (decode, resize, hash, encrypt, decrypt)
  features/
    auth/         sign-in, key entry, first-run key generation
    library/      virtualised photo grid, selection, bulk actions
    upload/       drop zone, pipeline progress UI
    lightbox/     review-and-tag workflow
    tags/         tag manager, implication editor
    layouts/      layout designer canvas
    filters/      filter builder
    slideshow/    fullscreen engine, edge settings panel
    settings/     PIN, auto-lock, recovery code, export
```

State rules: Firestore listeners hydrate the stores; components read via
selectors that are **mode-aware by construction** (open mode selectors never
return secure items). Services are the only code touching Firebase or Web
Crypto.

## 9. Firebase security rules (sketch)

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
// Storage: same rule shape on users/{uid}/**
```

Plus App Check (reCAPTCHA/Play Integrity) to reject non-app clients, and a
sign-in restriction to the owner's single account (allowlist enforced in rules
via uid).
