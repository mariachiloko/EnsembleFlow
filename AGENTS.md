# EnsembleFlow AGENTS

## Current Phase

Phase 23: public frontend hosting and live deployment.

## Project Standards

- Keep the codebase simple enough to explain in interviews.
- Prefer readable, explicit code over clever abstractions.
- Build in small phases and document each step.
- Treat every scaffolded file as intentional, not placeholder noise.

## Architecture Decisions

- Frontend: React + Vite + TypeScript.
- Backend: AWS serverless.
- Authentication: Cognito.
  - user pool uses email as the sign-in identifier
  - password recovery goes through verified email
- API layer: API Gateway + Lambda.
- Data: DynamoDB for structured records.
- File storage: S3 for uploads such as profile photos, logos, and videos.
- Infrastructure: Terraform.

## Security Rules

- Never commit secrets, credentials, or state files.
- Do not hardcode AWS values that should stay environment-specific.
- Keep user uploads private unless a feature explicitly requires sharing.
- Keep `notes/` out of git so private working memory stays local.

## Conventions

- Use `README.md` for public-facing project explanation.
- Use `docs/` for technical architecture and reasoning.
- Use `notes/` for private session memory, tradeoffs, and issue logs.
- Keep Terraform readable and minimally abstracted.

## What Has Been Completed

- Initialized the repository.
- Renamed the default branch to `main`.
- Added the public docs: `README.md` and `docs/architecture.md`.
- Added the private worklog in `notes/`.
- Added the frontend scaffold.
- Added the Terraform scaffold.
- Defined the first product data model in docs.
- Added Terraform resources for Cognito, DynamoDB, S3, Lambda, and API Gateway.
- Initialized Terraform and generated the lock file.
- Added a dashboard-style frontend shell with backend health awareness.
- Added real profile, ensemble, and upload handler logic.
- Added form-based frontend workflows that can use a Cognito token.
- Added Cognito Hosted UI settings and a PKCE sign-in flow.
- Added auth-aware frontend controls and session persistence.
- Added assignment, submission, and feedback workflows.
- Added section and membership management.
- Added role-aware director/member workspace behavior.
- Added submission comments and in-app notifications.
- Added demo content scaffolding for preview mode.
- Added deployment notes that call out when AWS credentials are needed.
- Deployed the live AWS dev stack with Terraform and verified the API health route.
- Wired the frontend to the live Cognito and API outputs in a local-only env file.
- Added a sign-in-first app gate so the workspace is hidden until a user is authenticated.
- Added ensemble code requests, director approval, co-director access, and member removal flows.
- Restricted privileged roles so director, co-director, and leader assignments are made only by existing management.
- Switched Cognito to email-based sign-in and email-based password recovery.
- Refined the signed-in workspace to lead with a member dashboard, profile summary, and profile-edit modal.
- Removed the inline profile email editor from the main page.
- Reworded the workspace so regular users see member-focused labels instead of director wording.
- Added a director/member portal split with separate sign-in entry points.
- Added an approved director email allowlist.
- Added unique usernames backed by a reserved-username table.
- Added blocked membership status support.
- Added submission expiration metadata and S3 cleanup for submission videos.
- Added a director-only navigation flow with home, ensemble, section, assignment, and announcement views.
- Added section-scoped assignment targeting.
- Added ensemble announcement fan-out through the notifications system.
- Added section conversations and group messaging for members.
- Added a member ensemble drill-down that keeps announcements, section people, messages, and outstanding assignments in one place.
- Simplified the default workspace so the main page is ensemble-first instead of a long mixed dashboard.
- Added a safe profile-email backfill path so the backend can remember the sign-in email after the first profile save.
- Added a local-only director email hint for the browser UI so the director portal opens consistently on this machine.
- Added a build-time director email injection path for the public frontend so the approved director portal can be built without committing private email data.
- Kept the requested portal mode active immediately after Cognito callback so a valid director login does not momentarily or later fall back to member mode.
- Added profile-photo rendering in the account avatar so a saved upload appears in the live UI after refresh.
- Hid ensemble-specific director navigation until an ensemble is selected so the home view only shows ensemble creation and the list of ensembles.
- Removed visible API/auth status chips from the signed-in layout so the UI stays product-focused instead of showing backend status.
- Reduced the director sidebar to product navigation only, with ensemble drill-down kept inside the selected ensemble screen.
- Standardized successful form saves so they either close the dialog or show a clear success toast.
- Added signed S3 read URLs so uploaded ensemble logos can render as actual images in the UI.
- Removed the duplicate ensemble drill-in button cluster so the selected ensemble screen only shows one set of action cards.
- Added a selected-ensemble photo editor so an ensemble can be updated from its own screen.
- Stopped auto-opening the profile modal on login so the dashboard loads first.
- Added a member-facing announcement panel that appears after an ensemble is selected.
- Removed the member overview/profile duplicates so the member dashboard stays focused on the selected ensemble.
- Added a profile save fallback username path so blank modal state does not trigger an internal error.
- Added a member practice upload form that appears after selecting an ensemble.
- Simplified the member left navigation to the minimal ensemble-focused set.
- Split the member workspace into an ensemble drill-down so announcements, section people, messages, and assignments open as separate focused views.
- Hardened the profile save path so blank or stale username state falls back cleanly and transaction failures do not surface as a generic internal server error.
- Deployed the new conversations tables and message routes to the live AWS stack.
- Restored the private director email allowlist in the live Lambda environment after the deploy.
- Added DynamoDB transaction permission to the Lambda role so profile saves can complete.
- Loaded the selected director ensemble details so its existing join code can be shown after opening the ensemble.
- Kept the ensemble join code visible on the opened ensemble screen instead of only showing it after a new ensemble is created.
- Replaced the raw member user-id field with an approved-member picker for section placement.
- Added explicit ensemble roster and section roster views on the director side.
- Added a section roster panel so the director can compare the full ensemble list against one section at a time.
- Added local session expiration checks so old Cognito tokens are cleared instead of silently reused.
- Updated director/member sign-in to clear the previous local session before starting Cognito login.
- Added a forced login prompt for portal sign-in so Cognito does not silently reuse a different email account.
- Moved section placement into the opened director ensemble screen so a director can assign approved members without leaving the ensemble context.
- Filtered join requests to pending-only so already-handled requests do not keep showing an approve button.
- Added director member-detail views with missing assignments, submissions, remove/block actions, and direct messaging.
- Updated conversation loading so directors can load ensemble conversations and members still load only section conversations.
- Added membership profile-label enrichment so rosters can show display name or username instead of raw Cognito user IDs.
- Added frontend member-name fallbacks so old records still render cleanly if a member has not saved a profile yet.
- Added the Lambda `BatchGetItem` permission needed to load profile labels for roster membership lists.
- Removed remaining raw section and assignment ID labels from the UI so member and director screens stay name-first.
- Added a selected-submission detail window for assignments so users can open a submission, see notes and video, add comments, review it, or delete it without juggling ID dropdowns.
- Added a member-facing submissions list so members can reopen their own uploads and delete them from the same detail window.
- Added a DELETE /submissions API route and enriched submission records with owner display labels so the UI can stay name-first.
- Added a compact submission video preview that opens the player in its own pop-up viewer instead of stretching the review panel.
- Removed the separate inbox drawer and profile-card inbox button after deciding to keep messaging inside the section and ensemble views only.
- Changed frontend deployment so `index.html` is served with no-cache headers while assets stay long-lived cached.
- Added the EnsembleFlow logo as a frontend SVG asset and favicon.
- Replaced text-only brand labels in the sign-in screen, sidebar, and hero header with the logo lockup.
- Replaced the squeezed full-logo usage with a compact mark plus live wordmark so the brand scales cleanly in sidebars and headers.
- Shifted the app color system from beige/green to navy, electric blue, cyan, and purple to match the EnsembleFlow mark.
- Restored the app mark closer to the original music/play/flow concept while keeping the separate side wordmark.
- Fixed the logo mark SVG viewBox/padding so the restored mark no longer renders clipped in the header/sidebar.
- Added the missing Lambda IAM permission for the usernames table so profile saves can complete without a generic `Internal Server Error`.
- Added the missing Lambda `DeleteItem` permission for the usernames table so username changes can remove the old reserved username row without failing.
- Verified profile save end-to-end against the live API with a real Cognito access token and got an HTTP 200 response.
- Widened the logo SVG canvas and adjusted the rendered size so the mark has enough breathing room in compact layouts.
- Added CloudFront and a private S3 bucket for public frontend hosting.
- Wired the CloudFront frontend URL into Cognito callback/logout URLs, API CORS, and upload bucket CORS.
- Added `scripts/deploy_frontend.sh` to build the Vite app from Terraform outputs, upload to S3, and invalidate CloudFront.
- Deployed the frontend publicly at the current CloudFront URL.
- Added an auth-loading gate so the app waits for session resolution before showing sign-in or workspace content.

## What Still Needs To Happen

- Tighten refresh-token and session-expiry handling if needed.
- Decide whether to keep or replace the local-only live env file before wider sharing.
- Decide whether to add a Google identity provider later, if a second login option is still desired.
- Decide whether to add a separate private promotion flow for trusted members who should become directors later.
- Decide whether to add Google sign-in later as a second identity provider.
- Verify the first email-based sign-up and password reset flow in the browser after the frontend reloads.
- Verify the new director ensemble, section, assignment, and announcement views in the browser.
- Verify the profile email backfill keeps director access stable across sign-outs and reloads.
- Restart the local Vite server after `.env.local` changes so the director hint actually loads into the running frontend.
- Verify the member ensemble drill-down in the browser after the frontend reloads.
- Verify the ensemble-first layout in the browser after the frontend reloads.
- Verify profile save in the browser now that the backend error handling is deployed.
- Verify the opened director ensemble shows its existing join code after refresh.
- Verify the director section roster and ensemble roster read cleanly in the browser.
- Verify director sign-in after being away shows the intended email/account instead of reusing a stale member session.
- Verify the public frontend now opens the director dashboard consistently after a valid director sign-in.
- Verify the public account avatar still renders the uploaded profile photo after sign-out and sign-in.
- Verify section placement from the opened director ensemble screen with a real approved member.
- Verify direct member messages appear in both the director and member section conversation views.
- Refresh AWS credentials and rerun Terraform apply; the first deploy attempt for profile-label enrichment failed because the AWS SSO token was expired.
- Verify rosters and message sender labels show member display names/usernames after the backend deploy.
- Verify the submission video preview opens a focused pop-up player and stays compact in the surrounding review panel.
- Verify `index.html` is not stuck behind browser or edge cache after the deploy script change.
- Decide later if a transparent PNG export is needed for app store/social/portfolio mockups.
- Review the updated dark/light branding in the browser and tune spacing if the mark should be larger or smaller.
- Replace the CloudFront URL with a custom domain later if a cleaner share link is wanted.
