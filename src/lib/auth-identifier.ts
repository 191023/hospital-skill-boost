/**
 * Auth Identifier Normalization & Synthetic Email Utility
 * Hospital Skill Boost - Overbrook Hospital
 */

export const INTERNAL_STAFF_DOMAIN = "@staff.ovb";

export type IdentifierType = "email" | "employee_id" | "phone";

export interface ParsedIdentifier {
  type: IdentifierType;
  rawInput: string;
  authEmail: string; // Email string sent to Supabase Auth
  displayIdentifier: string; // Clean string shown in UI
  employeeId?: string;
}

/**
 * Normalizes user input (email, staff code, or phone number)
 * into a format accepted by Supabase Auth (synthetic email if no email provided).
 */
export function parseAuthIdentifier(input: string): ParsedIdentifier {
  const clean = input.trim();

  if (!clean) {
    return {
      type: "employee_id",
      rawInput: "",
      authEmail: "",
      displayIdentifier: "",
    };
  }

  // 1. If it contains '@', treat as standard real email
  if (clean.includes("@")) {
    const email = clean.toLowerCase();
    return {
      type: "email",
      rawInput: clean,
      authEmail: email,
      displayIdentifier: email,
    };
  }

  // 2. If 9-10 digits starting with 0, treat as mobile phone number
  const isPhone = /^0\d{8,9}$/.test(clean);
  if (isPhone) {
    return {
      type: "phone",
      rawInput: clean,
      authEmail: `${clean}${INTERNAL_STAFF_DOMAIN}`.toLowerCase(),
      displayIdentifier: clean,
      employeeId: clean,
    };
  }

  // 3. Otherwise treat as Employee ID / Staff Code (e.g. 660142, EMP1024, A105)
  const empCode = clean.replace(/\s+/g, "").toUpperCase();
  return {
    type: "employee_id",
    rawInput: clean,
    authEmail: `${empCode.toLowerCase()}${INTERNAL_STAFF_DOMAIN}`,
    displayIdentifier: empCode,
    employeeId: empCode,
  };
}

/**
 * Check if an email is an internal synthetic email (generated for non-email staff)
 */
export function isSyntheticEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(INTERNAL_STAFF_DOMAIN);
}

/**
 * Get human-readable identifier (shows Staff ID if email is synthetic)
 */
export function getDisplayIdentifier(email?: string | null, employeeId?: string | null): string {
  if (employeeId && employeeId.trim()) {
    return employeeId.trim();
  }
  if (!email) return "-";
  if (isSyntheticEmail(email)) {
    return email.replace(new RegExp(`${INTERNAL_STAFF_DOMAIN}$`, "i"), "").toUpperCase();
  }
  return email;
}
