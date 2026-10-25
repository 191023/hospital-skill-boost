---
name: rest-api-integrator
description: Best practices for designing, connecting, and consuming RESTful APIs, handling HTTP states, data fetching, and error recovery.
---

# REST API Integration Standards

Apply these patterns when building or consuming backend REST APIs:

## 1. Clean Data Fetching & Async Handling
- Use modern `async/await` with `fetch` or Axios for HTTP requests.
- Implement clear request states: Loading, Success, Empty Data, and Error.

## 2. Robust Error & Status Management
- Always check response HTTP status codes (`response.ok`, 2xx, 4xx, 5xx).
- Handle network timeouts and offline network states gracefully with user feedback.

## 3. Data Transformation & Schema Safety
- Safely extract and transform API payloads before rendering.
- Never assume external API payloads contain non-null properties; validate object structures before dereferencing.
