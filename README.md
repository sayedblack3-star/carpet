<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/89006244-0f82-4ef5-bfec-30160486f2aa

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Create a `.env.local` file from `.env.example`.
3. Add your Supabase project settings to `.env.local`:
   `VITE_SUPABASE_URL=...`
   `VITE_SUPABASE_ANON_KEY=...`
4. If Public Signup is disabled and admins will create employee accounts from the dashboard, also add:
   `SUPABASE_URL=...`
   `SUPABASE_SERVICE_ROLE_KEY=...`
5. Optional: set the `GEMINI_API_KEY` in `.env.local` if you use Gemini-powered features.
6. Run the app:
   `npm run dev`

## Android APK

The web app stays exactly as-is. The Android app is an additional wrapper around the same React UI and the same Supabase database.

### What is already wired

- Capacitor is configured in `capacitor.config.ts`
- The Android project lives in `android/`
- The APK uses the built web assets from `dist/`

### Mobile commands

- Build web assets only:
  `npm run build:web`
- Copy the latest web build into the mobile project:
  `npm run mobile:copy`
- Build web assets and sync Android:
  `npm run mobile:sync`
- Open the Android project in Android Studio:
  `npm run mobile:open`

### Android prerequisites

- JDK 17 or newer
- Android Studio
- Android SDK installed and configured
- `JAVA_HOME` and `ANDROID_SDK_ROOT` (or `ANDROID_HOME`) set

### Build the APK

1. Run:
   `npm run mobile:sync`
2. Open Android Studio:
   `npm run mobile:open`
3. In Android Studio, build a debug APK or release APK from the `android/` project.

## Desktop App

The desktop app is an Electron wrapper around the same React UI, the same Supabase database, and the same employee accounts.

### Desktop commands

- Run Electron with the local Vite dev server:
  `npm run desktop:dev`
- Build the web app and open it inside Electron:
  `npm run desktop:start`
- Build an unpacked Windows desktop app:
  `npm run desktop:pack`
- Build Windows installer/portable output:
  `npm run desktop:dist`

### Desktop output

- Desktop build artifacts are generated in:
  `desktop-release/`
