# Client Template Setup

This project is now prepared to be reused for new clients with a single branding file.

## 1. Edit client.config.json

Update these fields before preparing a new client copy:

- `companyNameAr`
- `companyNameEn`
- `systemName`
- `tagline`
- `webBadgeLabel`
- `desktopSubtitle`
- `mobileSubtitle`
- `versionLabel`
- `author`
- `webTitle`
- `metaDescription`
- `mobileAppName`
- `mobileAppId`
- `desktopProductName`
- `desktopAppId`

## 2. Apply the branding

Run:

```bash
npm run client:apply
```

This updates:

- `package.json`
- `capacitor.config.ts`
- `electron/main.cjs`
- `index.html`
- `android/app/src/main/res/values/strings.xml`

## 3. Configure environment and backend

Create a separate backend for each client:

- new Supabase project
- new `.env.local`
- new admin account
- new Vercel project or new hosting setup

Never share the same database between different clients.

## 4. Build each platform

Web:

```bash
npm run build
```

Android:

```bash
npm run mobile:sync
```

Then build the APK from `android/`.

Desktop:

```bash
npm run desktop:dist
```

## 5. Replace logos if needed

If the new client has a different logo, update the generated branding assets before final delivery:

- `public/brand/web/`
- `public/brand/mobile/`
- `public/brand/desktop/`
- `electron/assets/`

Then rebuild the target platform.
