---
name: Imported bot vs. live deployment
description: How to reason about bug reports against a freshly-imported bot/webhook project that may not be the same code the user is actually testing against.
---

When a user imports a chat-bot-style project (Facebook Messenger, Telegram, etc.) and then reports a behavior bug based on testing the *live* bot, don't assume the imported Replit code is what they're hitting.

**Why:** These projects are frequently deployed elsewhere too (Vercel, Render, etc.) with the webhook already pointed at that other deployment. The freshly imported Replit copy may lack the provider secrets (access tokens, verify tokens) needed to actually serve real traffic, so it's a separate, unconnected copy of the code — possibly newer or older than what's live.

**How to apply:** Reproduce the reported behavior locally first (call the handler/module directly with mocked send functions, or hit the underlying API directly) before concluding the code is broken or fixed. If the local repro doesn't match the reported symptom, check whether the required provider secrets are configured — their absence is a strong signal the live traffic is going to a different deployment, not this one.
