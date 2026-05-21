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

