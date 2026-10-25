---
name: browser-automation-qa
description: Workflows for running dev servers, inspecting browser console logs, executing automated UI tests, and verifying live web app functionality.
---

# Browser Automation & QA Testing Guide

Follow these testing protocols after editing or creating web application files:

## 1. Dev Server Launch & Verification
- Always launch a local dev server (e.g. `npx serve`, `npm run dev`, or `python -m http.server`) to verify web apps live.
- Check the server output for build failures or missing assets.

## 2. Console & Error Inspection
- Inspect runtime logs for exceptions, 404 resource errors, or unhandled promise rejections.
- Diagnose and fix root causes immediately; never hide errors with silent try/catch blocks.

## 3. UI & Responsive Testing
- Verify responsive layout behavior across desktop, tablet, and mobile viewports.
- Test interactive user flows (button clicks, form submits, modal dialogs, tab switching).
