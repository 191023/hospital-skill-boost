import { describe, it, expect } from "vitest";
import {
  parseAuthIdentifier,
  isSyntheticEmail,
  getDisplayIdentifier,
  INTERNAL_STAFF_DOMAIN,
} from "@/lib/auth-identifier";

describe("Auth Identifier Normalization", () => {
  it("recognizes standard email addresses", () => {
    const res = parseAuthIdentifier("Doctor.Somchai@gmail.com ");
    expect(res.type).toBe("email");
    expect(res.authEmail).toBe("doctor.somchai@gmail.com");
    expect(res.displayIdentifier).toBe("doctor.somchai@gmail.com");
    expect(res.employeeId).toBeUndefined();
  });

  it("converts Thai mobile phone number to synthetic email", () => {
    const res = parseAuthIdentifier(" 0812345678 ");
    expect(res.type).toBe("phone");
    expect(res.authEmail).toBe(`0812345678${INTERNAL_STAFF_DOMAIN}`);
    expect(res.displayIdentifier).toBe("0812345678");
    expect(res.employeeId).toBe("0812345678");
  });

  it("converts Employee ID / Staff Code to synthetic email", () => {
    const res1 = parseAuthIdentifier(" 660142 ");
    expect(res1.type).toBe("employee_id");
    expect(res1.authEmail).toBe(`660142${INTERNAL_STAFF_DOMAIN}`);
    expect(res1.displayIdentifier).toBe("660142");
    expect(res1.employeeId).toBe("660142");

    const res2 = parseAuthIdentifier("emp-1024");
    expect(res2.type).toBe("employee_id");
    expect(res2.authEmail).toBe(`emp-1024${INTERNAL_STAFF_DOMAIN}`);
    expect(res2.displayIdentifier).toBe("EMP-1024");
  });

  it("identifies synthetic emails correctly", () => {
    expect(isSyntheticEmail("somchai@gmail.com")).toBe(false);
    expect(isSyntheticEmail(`660142${INTERNAL_STAFF_DOMAIN}`)).toBe(true);
    expect(isSyntheticEmail(null)).toBe(false);
  });

  it("formats display identifier properly", () => {
    // When employeeId is present, show employeeId
    expect(getDisplayIdentifier("660142@staff.ovb", "660142")).toBe("660142");
    // When employeeId is null but email is synthetic, strip domain
    expect(getDisplayIdentifier("660142@staff.ovb", null)).toBe("660142");
    // When real email, show real email
    expect(getDisplayIdentifier("somchai@ovbhospital.com", null)).toBe("somchai@ovbhospital.com");
    // Fallback
    expect(getDisplayIdentifier(null, null)).toBe("-");
  });
});
