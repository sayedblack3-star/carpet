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
4. Optional: set the `GEMINI_API_KEY` in `.env.local` if you use Gemini-powered features.
5. Run the app:
   `npm run dev`
