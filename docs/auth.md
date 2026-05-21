# EnsembleFlow Authentication

## Sign-In Flow

EnsembleFlow uses Cognito Hosted UI with the authorization code flow and PKCE.

## Why This Approach

- The browser can sign in without storing AWS credentials.
- The app can work in a self-hosted AWS account without a custom auth server.
- The frontend receives an access token that it sends to the API as a bearer token.

## Runtime Steps

1. The user clicks sign in.
2. The frontend redirects to the Cognito hosted UI.
3. Cognito returns an authorization code to the app callback URL.
4. The frontend exchanges the code for tokens.
5. The access token is stored locally and used for API calls.

## Logout

The sign-out flow clears the local session and sends the browser to Cognito logout when the logout URL is configured.

