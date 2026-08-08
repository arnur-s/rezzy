# Product

## Register

product

## Product Definition

Rezzy is an **AI-powered customer engagement platform** for customer-facing teams. It brings customer conversations, public social interactions, contact context, and eventually outbound social publishing into one workspace.

The shared inbox is Rezzy's wedge and operational center. The product should expand outward from the inbox without losing the speed and clarity that make an inbox useful.

Rezzy is not trying to become a generic CRM, a marketing suite, or an enterprise social-media platform. It should connect the customer-facing work that naturally belongs together: receive an interaction, understand the person and context, respond, follow up, and learn from the result.

## Users

### Primary users

Sales teams and account managers who manage customer relationships across multiple communication channels. Their day-to-day context: they open Rezzy to see what's new, triage conversations from leads and customers, reply or route them, and stay on top of contact history.

### Expanding users

As engagement and publishing capabilities grow, social/community managers and small marketing teams may also use Rezzy to handle comments, mentions, social replies, and scheduled content. These users should share the same workspace and customer context rather than operate in a disconnected social tool.

The product should remain optimized for busy teams that context-switch frequently and expect the system to surface what matters without requiring them to hunt for it.

## Product Purpose

Rezzy helps a business manage the full customer-engagement loop from one place:

1. **Receive** — collect private messages and, over time, public interactions such as comments and mentions.
2. **Understand** — connect interactions to contacts, history, channel context, intent, priority, and relevant business knowledge.
3. **Respond** — reply manually, use AI assistance, or allow approved automations to act within clear boundaries.
4. **Engage** — manage public comments, mentions, reviews, and other customer-facing social interactions alongside private conversations.
5. **Publish** — plan, generate, schedule, and publish social content without disconnecting it from customer engagement.
6. **Learn** — use conversation and content outcomes to improve triage, responses, automations, and future content.

A successful Rezzy session should still feel simple: open the product, understand what needs attention, act, and move on.

## Product Shape

Rezzy is one product with several bounded domains, not several unrelated products bundled together.

### Inbox

The operational center for private customer conversations.

Responsibilities include:

- unified conversations across supported channels
- unread and priority triage
- assignment and ownership
- replies and internal collaboration
- contact context and history
- conversation state such as open, closed, and snoozed

### Engage

Public customer interactions that behave like conversations but are not private messages.

Examples include:

- comments
- replies to comments
- mentions
- reviews
- other provider-supported social interactions

Engage should reuse contact, workspace, assignment, AI, and automation concepts where they genuinely fit, without forcing comments into the private-message data model.

### Publish

Outbound social presence management.

Examples include:

- content drafts
- platform-specific variants
- scheduling
- publishing
- campaigns or content groups
- lightweight performance analytics
- AI-assisted content generation

Publishing should connect naturally to engagement. A published post may produce comments, leads, or conversations that flow back into Rezzy.

### Contacts / CRM

Customer context shared across Inbox and Engage.

Rezzy's CRM should remain deliberately lightweight and communication-centered. Contact history, notes, ownership, status, and relevant channel identities matter. Enterprise-style CRM breadth does not.

### AI

AI is a cross-product capability, not a separate destination that users must manage for its own sake.

AI may assist with:

- reply drafting
- summarization
- intent and sentiment classification
- priority and routing signals
- spam detection
- knowledge-grounded answers
- social post generation and adaptation
- comment response drafting
- analytics interpretation
- automation decisions within configured rules

The user should experience useful outcomes, not model names, token counts, or prompt plumbing.

### Automation

Automation connects product events to actions.

Examples:

- when a new comment arrives, classify it and create a suggested reply
- when purchase intent is detected, assign or create a CRM follow-up
- when sentiment is risky, require human review
- when a scheduled publishing time arrives, publish an approved post

Automations should build on real product workflows. Do not add a generic workflow builder before concrete recurring use cases justify it.

## Core Product Loop

The long-term product loop is:

`Publish -> Engage -> Inbox / CRM -> Respond -> Learn -> Publish`

Not every workspace will use every part of the loop. Rezzy should remain valuable as an inbox-first product even when publishing or automation is not enabled.

## Current Product vs Product Direction

Product documentation may describe the intended direction, but the repository implementation remains the source of truth for what exists today.

Do not present planned capabilities as shipped. Do not introduce speculative architecture merely because a future domain appears in this document.

When building a new domain, extend existing patterns deliberately and establish the smallest useful boundary needed for the real feature.

## AI Product Principles

1. **AI should reduce work, not create a second workflow.** Suggestions and automation belong inside the task the user is already performing.
2. **Human control scales with risk.** Drafting and classification can be lightweight; publishing, sensitive replies, pricing claims, complaints, and other high-impact actions may require approval.
3. **Autonomy is a product setting, not an assumption.** Prefer progression from manual to assisted to approved automation to carefully scoped autopilot.
4. **Ground generated answers when business facts matter.** AI should use workspace knowledge or authoritative product data rather than improvise factual claims.
5. **Track cost internally, expose value externally.** Customers should not need to understand tokens or provider pricing.
6. **Cheap intelligence can be ambient.** Low-cost classification, language detection, spam signals, and similar background assistance may be included as product intelligence rather than individually metered.
7. **Meaningful generated work may be metered as AI actions.** One user-visible outcome should not become several billable units merely because it required multiple internal model calls.
8. **Provider and model choices are implementation details.** Rezzy should be able to change routing, models, caching, or providers without redesigning the customer pricing model.

## Pricing Principles

Pricing should remain understandable even as Rezzy gains more capabilities.

Preferred structure:

- workspace subscription
- included seats with simple additional-seat pricing
- channel limits appropriate to the plan
- an included allowance for billable AI actions
- optional AI overage or usage packs
- higher tiers for autonomous/advanced automation, permissions, and analytics

Do not price customer-facing plans in raw LLM tokens. Do not create a separate quota for every AI feature unless real usage economics require it.

See `PRICING.md` for the working pricing model and metering rules.

## Brand Personality

Warm, human, practical. The product should feel like a reliable colleague — not cold and corporate, not casual and chat-room-ish. Close in spirit to Front or Intercom: professional tools that feel built for real people doing real work.

AI should follow the same personality. It should feel useful and calm, not magical, theatrical, or constantly announcing itself.

## References

- **Front.app** — inbox-first, multi-channel, calm information hierarchy.
- **Intercom** — customer communication platform with strong conversation context and human-readable customer profiles.

These are references for product quality and workflow clarity, not templates to copy feature-for-feature.

## Anti-references

- **Generic SaaS admin dashboard** — grey tables, blue primary buttons, interchangeable design language.
- **Enterprise CRM bloat (Salesforce, HubSpot)** — cluttered, overwhelming, designed around feature inventory rather than daily work.
- **Standalone AI wrapper** — a prompt box detached from the workflow, with AI as the product rather than the capability.
- **Social-suite sprawl** — dozens of publishing, listening, analytics, ads, and campaign features added before they strengthen Rezzy's customer-engagement loop.
- **Startup landing-page-as-app** — gradients, metric showcases, and decorative complexity that slow the workflow.

## Design Principles

1. **Clarity over comprehensiveness.** Every screen has one primary job. Information hierarchy should guide the eye without requiring effort.
2. **Human before data.** Contacts are people, not rows. Foreground who someone is and what happened before surfacing metrics or tags.
3. **Workflow-native rhythm.** Match the natural pace of a customer-facing workday: triage, understand, reply, note, move on.
4. **One context across channels.** Private messages, public interactions, and contact history should feel connected where the underlying customer relationship is connected.
5. **AI in the flow.** AI should appear at the moment it saves work, not as a separate control center users must operate.
6. **Progressive autonomy.** Make assisted workflows excellent before expanding into unattended automation.
7. **Warmth in the details.** Personality shows up in copy, empty states, and transitions — not decorative elements that slow the tool down.
8. **Confidence through restraint.** Trust is built through predictability. The interface should not surprise users with hidden actions or unexplained automation.

## Accessibility & Inclusion

No formal WCAG compliance target currently. Prioritize good keyboard navigation, sufficient contrast for sustained reading, accessible form patterns, and understandable AI/automation states. Revisit formal compliance as the product scales to a broader user base.
