const rawApiUrl = import.meta.env.VITE_API_URL;

export const apiUrl =
  typeof rawApiUrl === "string" && rawApiUrl.trim().length > 0
    ? rawApiUrl.replace(/\/$/, "")
    : "";

export async function fetchHealthSignal(): Promise<string> {
  if (!apiUrl) {
    return "API URL not configured";
  }

  const response = await fetch(`${apiUrl}/health`, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    return `API returned ${response.status}`;
  }

  const data = (await response.json()) as { service?: string; ok?: boolean };

  if (data.ok) {
    return `Connected to ${data.service ?? "API"}`;
  }

  return "API responded without an ok flag";
}

type ApiOptions = {
  token?: string;
  body?: unknown;
  method?: string;
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!apiUrl) {
    throw new Error("API URL not configured");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export type ProfilePayload = {
  email?: string;
  displayName: string;
  photoKey?: string;
};

export type ProfileRecord = {
  userId: string;
  email: string;
  displayName: string;
  photoKey: string;
};

export type EnsemblePayload = {
  name: string;
  description?: string;
  logoKey?: string;
};

export type UploadPayload = {
  fileName: string;
  contentType: string;
  fileType: string;
  ensembleId?: string;
};

export async function getCurrentProfile(token: string) {
  return request<{ profile: ProfileRecord | null }>("/profiles", { token });
}

export async function upsertProfile(token: string, payload: ProfilePayload) {
  return request<{ profile: ProfileRecord }>("/profiles", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function listEnsembles(token: string) {
  return request<{
    ensembles: Array<{
      ensembleId: string;
      ownerId: string;
      name: string;
      description: string;
      logoKey: string;
    }>;
  }>("/ensembles", { token });
}

export async function createEnsemble(token: string, payload: EnsemblePayload) {
  return request<{
    ensemble: {
      ensembleId: string;
      ownerId: string;
      name: string;
      description: string;
      logoKey: string;
    };
  }>("/ensembles", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function createUploadPresign(token: string, payload: UploadPayload) {
  return request<{
    uploadId: string;
    fileKey: string;
    uploadUrl: string;
  }>("/uploads/presign", {
    token,
    body: payload,
    method: "POST",
  });
}
