# Educaro Supabase setup

The application uses Supabase Auth, private Storage buckets, and Row Level Security. Apply all migrations in `supabase/migrations` before deploying the Edge Functions.

## Deploy

From the project directory, create a Supabase personal access token from your Supabase account settings. Sign in through the local CLI using that token when prompted; never paste it into chat or commit it:

```powershell
npx --yes supabase@latest login
```

Configure backend secrets in the Supabase Dashboard under **Project Settings → Edge Functions → Secrets**. Add:

- `ADMIN_EMAILS`: the project owner's verified admin inbox (comma-separated if more than one is explicitly authorized).
- `ADMIN_OTP_PEPPER`: a randomly generated secret of at least 32 characters.
- `RESEND_API_KEY`: the Resend API key used to email admin verification codes and applicant decisions.
- `EDUCARO_FROM_EMAIL`: a sender address verified with Resend.
- `OPENAI_API_KEY`: required for interview transcription, document analysis, and CV generation.

Do not send these secrets in chat, add them to `VITE_*` variables, or commit them. Supabase supplies its standard `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically.

The local frontend `.env` must contain the project's `VITE_SUPABASE_URL` and public `VITE_SUPABASE_ANON_KEY`. These are browser configuration, not backend secrets. For local Edge Function development only, copy `supabase/functions/.env.example` to `supabase/functions/.env` and fill the server-side values; that file is gitignored.

After the secrets are saved and the CLI is authenticated, run the deployment script from PowerShell:

```powershell
.\deploy-supabase.ps1
```

The script links this project, applies the database migrations, and deploys all required Edge Functions. It stops on the first failed command so incomplete deployment is visible.

Never put `ADMIN_EMAILS`, `ADMIN_OTP_PEPPER`, service-role keys, or provider keys in a `VITE_*` variable, browser code, or committed file. `supabase/functions/.env` is ignored by Git; use it only for local Edge Function development, for example with `supabase functions serve --env-file supabase/functions/.env`. The frontend needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; Resend must have a verified sender domain/address.

Keep Supabase email/password authentication enabled and require email confirmation for new accounts. Resend delivers a separate, short-lived, single-use verification code for admin sign-in.

## Admin access and authorization

- Normal accounts register and sign in with email and password. Reviewer sign-in requires the fixed allowlisted account's password followed by a one-time code sent to that account's verified email. The backend derives the email and session ID from the verified Supabase session; no frontend role or email is trusted.
- Only an owner-authorized `ADMIN_EMAILS` address can request a reviewer code. A successful second-factor check authorizes only that specific Supabase session for up to eight hours and initializes the profile's `admin` role. New reviewer accounts must first be registered with the configured address, confirm the email, then complete the reviewer password-and-code flow. There is no public admin-role selection or promotion endpoint, and public profile updates cannot promote an applicant.
- The admin dashboard, applicant/document listing, signed document links, and review decisions require a verified session whose trusted email is allowlisted and whose profile role is `admin`. The Edge Functions return `401` for missing/invalid sessions and `403` for authenticated non-admins; RLS and private Storage policies also enforce admin access for direct database/storage requests.
- If the earlier custom `admin-login` function was deployed, remove it: `supabase functions delete admin-login --project-ref YOUR_SUPABASE_PROJECT_REF`, then unset the obsolete `EDUCARO_ADMIN_JWT_SECRET`. `ADMIN_OTP_PEPPER` remains required for the current, session-bound admin email-code flow. Migration `20261009000300_configure_allowlisted_admins.sql` retires the old challenge mechanism and installs the session-bound policies.

## Deploy the website to Vercel or GitHub Pages

The Vite website is a static frontend; Supabase Auth, database, storage, and Edge Functions are its backend and must be deployed separately using the Supabase steps above. Use the directory containing this guide's parent `package.json` as the frontend project root. If this source is kept in a larger repository, put the contents of the `project` directory (including `.github` and `vercel.json`) at the repository root, or adjust the hosting root directory and workflow paths accordingly.

### Vercel

1. Push the frontend project to a GitHub repository and import that repository in Vercel.
2. Set the Vercel **Root Directory** to the directory containing `package.json` (usually `project` if the parent repository contains this folder; otherwise `.`).
3. Use the Vite defaults: build command `npm run build`, output directory `dist`, install command `npm install` (or `npm ci`). The included `vercel.json` configures these and sends SPA routes to `index.html`.
4. In Vercel **Project Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and Preview, then redeploy. The Supabase URL and anon/publishable key are browser-visible configuration, not secrets; never put service-role, admin, Resend, or OpenAI secrets in Vercel frontend variables.
5. After the first deploy, copy the production domain. In Supabase **Authentication → URL Configuration**, set the Site URL to that domain and add it and any required Vercel preview domains to the Redirect URLs. In **Authentication → Providers → Email**, enable password sign-in and email confirmation.

With Vercel's Git integration, commits pushed to the selected production branch deploy automatically; pull requests can have preview deployments.

### GitHub Pages

1. Keep this project directory as the GitHub repository root, push it to the `main` branch, and add repository **Settings → Secrets and variables → Actions → New repository secret** values named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. In **Settings → Pages → Build and deployment**, set the source to **GitHub Actions**.
3. Push to `main` or run **Actions → Build and deploy GitHub Pages → Run workflow**. The included `.github/workflows/deploy-pages.yml` installs dependencies, requires the Supabase frontend settings, builds the site with the correct GitHub Pages base path, and publishes `dist`.
4. Copy the published Pages URL into Supabase **Authentication → URL Configuration** as the Site URL or an allowed Redirect URL, as appropriate.

GitHub Pages serves only the frontend. It does not host the Supabase backend or secrets: apply the migrations and deploy all Edge Functions to Supabase, and set `ADMIN_EMAILS`, `ADMIN_OTP_PEPPER`, Resend, and AI provider secrets there. The `VITE_*` values are embedded in the built public JavaScript, so only use the Supabase URL and anon/publishable key for them.

## Applicant review workflow

- Applicant uploads are private and limited to PDF, JPG, or PNG files up to 10 MB. Required CV inputs are an English-test document, IELTS certificate, and degree certificate; other documents are supported.
- Applicants must explicitly consent before a document is sent to OpenAI for readability, document-category consistency, and visible-fact extraction. These checks cannot authenticate a document or mark it verified. Only a signed-in admin can review applicant files and decide to accept or reject.
- The CV function requires all three required document categories to be uploaded and analyzed. Its editable draft and optional improvement tips are based only on profile answers and extracted facts; applicants should review it and may ignore the tips.
- Admin decisions require a message, are saved to the application, and are sent to the applicant's registered email using Resend. If email delivery fails after the decision is saved, the admin can retry the notification from the review card.
- The short video interview is optional. The applicant consents before audio is sent for transcription and profile comparison. AI returns the transcript, optional communication tips, and text-only comparisons for education, German level, IT experience, interests, and future goal. It can flag only possible differences for the applicant to review; it cannot verify facts, infer deception, analyze facial expressions, appearance, emotion, or accent, or assess eligibility. The applicant may ignore the coaching. The admin alone makes the application decision.
- Applicant records are visible to their owner and authorized admins, never to other applicants. Private document and video Storage paths are scoped by applicant ID.
