const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function headers() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json",
  };
}

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  locationId: string;
  tags?: string[];
}

export interface GHLContactInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
}

// Create contact in GHL — returns GHL contact ID
export async function ghlCreateContact(data: GHLContactInput): Promise<string | null> {
  if (!process.env.GHL_API_KEY) return null;
  try {
    const res = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ...data, locationId: process.env.GHL_LOCATION_ID }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.contact?.id ?? null;
  } catch {
    return null;
  }
}

// Update existing GHL contact
export async function ghlUpdateContact(ghlId: string, data: GHLContactInput): Promise<boolean> {
  if (!process.env.GHL_API_KEY) return false;
  try {
    const res = await fetch(`${GHL_BASE}/contacts/${ghlId}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Fetch all contacts from GHL location (paginated — returns up to 100 per page)
export async function ghlGetContacts(page = 1): Promise<{ contacts: GHLContact[]; total: number }> {
  if (!process.env.GHL_API_KEY) return { contacts: [], total: 0 };
  try {
    const params = new URLSearchParams({
      locationId: process.env.GHL_LOCATION_ID!,
      limit: "100",
      startAfter: String((page - 1) * 100),
    });
    const res = await fetch(`${GHL_BASE}/contacts/?${params}`, {
      headers: headers(),
    });
    if (!res.ok) return { contacts: [], total: 0 };
    const json = await res.json();
    return {
      contacts: json?.contacts ?? [],
      total: json?.total ?? 0,
    };
  } catch {
    return { contacts: [], total: 0 };
  }
}

// Send SMS via GHL conversation
export async function ghlSendSMS(contactId: string, message: string): Promise<boolean> {
  if (!process.env.GHL_API_KEY) return false;
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        type: "SMS",
        contactId,
        message,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Send email via GHL conversation
export async function ghlSendEmail(
  contactId: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!process.env.GHL_API_KEY) return false;
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        type: "Email",
        contactId,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
