---
name: web-security-owasp
description: Guidelines for enforcing OWASP top 10 security standards, input sanitization, XSS prevention, CSRF protection, and secure data handling in web applications.
---

# Web Security & OWASP Standards

Apply these security controls to all web application development:

## 1. Cross-Site Scripting (XSS) Prevention
- Never inject untrusted dynamic user strings via `innerHTML` or `document.write`.
- Use `element.textContent` or safe DOM creation methods (`document.createElement`).
- Sanitize HTML content before rendering using secure sanitization routines if raw HTML is mandatory.

## 2. Input Sanitization & Validation
- Validate all user inputs on both client side and server side.
- Sanitize search queries, form inputs, and URL parameters to prevent injection attacks.

## 3. Secure State & Storage Handling
- Never store sensitive access tokens or credentials in unencrypted `localStorage` or plain JS global variables.
- Ensure cross-origin requests follow strict CORS policies.
- Enforce HTTPS and safe content security headers.
