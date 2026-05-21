const rawCognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
const rawCognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const rawCognitoRedirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
const rawCognitoLogoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI;
const rawCognitoScopes = import.meta.env.VITE_COGNITO_SCOPES;

const storageKeys = {
  session: "ensembleflow.auth.session",
  pkceVerifier: "ensembleflow.auth.pkce.verifier",
  pkceState: "ensembleflow.auth.pkce.state",
} as const;

export type AuthSession = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
};

export const cognitoDomain =
  typeof rawCognitoDomain === "string" && rawCognitoDomain.trim().length > 0
    ? rawCognitoDomain.replace(/\/$/, "")
    : "";

export const cognitoClientId =
  typeof rawCognitoClientId === "string" && rawCognitoClientId.trim().length > 0
    ? rawCognitoClientId
    : "";

export const cognitoRedirectUri =
  typeof rawCognitoRedirectUri === "string" && rawCognitoRedirectUri.trim().length > 0
    ? rawCognitoRedirectUri
    : "";

export const cognitoLogoutUri =
  typeof rawCognitoLogoutUri === "string" && rawCognitoLogoutUri.trim().length > 0
    ? rawCognitoLogoutUri
    : "";

const defaultScopes = "openid email profile";
export const cognitoScopes =
  typeof rawCognitoScopes === "string" && rawCognitoScopes.trim().length > 0
    ? rawCognitoScopes.trim()
    : defaultScopes;

function randomString(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(input: string) {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(hash));
}

export async function beginCognitoSignIn() {
  if (!cognitoDomain || !cognitoClientId || !cognitoRedirectUri) {
    throw new Error("Cognito settings are incomplete.");
  }

  const verifier = randomString(64);
  const state = randomString(24);
  const challenge = await sha256(verifier);

  window.localStorage.setItem(storageKeys.pkceVerifier, verifier);
  window.localStorage.setItem(storageKeys.pkceState, state);

  const authUrl = new URL(`${cognitoDomain}/oauth2/authorize`);
  authUrl.searchParams.set("client_id", cognitoClientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", cognitoScopes);
  authUrl.searchParams.set("redirect_uri", cognitoRedirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  window.location.assign(authUrl.toString());
}

export function buildCognitoLogoutUrl() {
  if (!cognitoDomain || !cognitoClientId || !cognitoLogoutUri) {
    return "";
  }

  const logoutUrl = new URL(`${cognitoDomain}/logout`);
  logoutUrl.searchParams.set("client_id", cognitoClientId);
  logoutUrl.searchParams.set("logout_uri", cognitoLogoutUri);
  return logoutUrl.toString();
}

export function loadStoredSession() {
  const raw = window.localStorage.getItem(storageKeys.session);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession) {
  window.localStorage.setItem(storageKeys.session, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(storageKeys.session);
  window.localStorage.removeItem(storageKeys.pkceVerifier);
  window.localStorage.removeItem(storageKeys.pkceState);
}

export function clearPkceState() {
  window.localStorage.removeItem(storageKeys.pkceVerifier);
  window.localStorage.removeItem(storageKeys.pkceState);
}

export function getStoredPkceState() {
  return window.localStorage.getItem(storageKeys.pkceState);
}

export function getStoredPkceVerifier() {
  return window.localStorage.getItem(storageKeys.pkceVerifier);
}

async function exchangeCodeForTokens(code: string, verifier: string) {
  if (!cognitoDomain || !cognitoClientId || !cognitoRedirectUri) {
    throw new Error("Cognito settings are incomplete.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cognitoClientId,
    code,
    redirect_uri: cognitoRedirectUri,
    code_verifier: verifier,
  });

  const response = await fetch(`${cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Cognito token exchange failed.");
  }

  return (await response.json()) as AuthSession & {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
}

export async function handleCognitoCallback(url = window.location.href) {
  const current = new URL(url);
  const code = current.searchParams.get("code");
  const state = current.searchParams.get("state");

  if (!code) {
    return null;
  }

  const expectedState = getStoredPkceState();
  const verifier = getStoredPkceVerifier();
  if (!expectedState || !verifier || expectedState !== state) {
    throw new Error("Cognito login state could not be verified.");
  }

  const tokens = await exchangeCodeForTokens(code, verifier);
  const session: AuthSession = {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    tokenType: tokens.token_type,
  };

  saveSession(session);
  clearPkceState();

  return session;
}

export function getAuthStatusText(session: AuthSession | null) {
  if (!session) return "Not signed in";
  return "Signed in with Cognito";
}
