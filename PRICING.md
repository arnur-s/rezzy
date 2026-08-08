# Rezzy Pricing Strategy

## Purpose

This document defines the working pricing and AI-metering model for Rezzy. Exact prices are provisional until real usage and willingness-to-pay data are available.

The goal is to keep customer pricing simple while preserving detailed internal cost accounting.

## Pricing Philosophy

Rezzy should charge for product value, not infrastructure vocabulary.

Customers should understand:

- what their plan includes
- how many people can use it
- how many channels/workspaces or other major capacity limits apply
- how much meaningful AI work is included
- what happens when they exceed the included AI allowance

Customers should not need to understand LLM tokens, model routing, provider names, cache behavior, or the number of internal model calls used to complete one task.

## Recommended Commercial Structure

Use:

`workspace subscription + included seats + extra seats + included AI actions + optional AI overage`

Plan boundaries may also include channel capacity, automation depth, permissions, and analytics where these create meaningful differences between customer types.

## Working Plan Shape

These numbers are starting hypotheses, not commitments.

| | Starter | Pro | Business |
| --- | ---: | ---: | ---: |
| Base price | ~$19/month | ~$49/month | ~$99-149/month |
| Included users | 2 | 5 | 10 |
| Additional users | simple per-seat price | simple per-seat price | simple per-seat price |
| Channels | small allowance | larger allowance | larger allowance |
| Shared inbox + CRM | Yes | Yes | Yes |
| Public engagement/comments | limited or unavailable | Yes | Yes |
| Social publishing | unavailable or limited | Yes | Yes |
| AI assistance | small allowance | generous allowance | generous allowance |
| Advanced AI automation/autopilot | No | limited | Yes |
| Analytics | basic | standard | advanced |

Keep the pricing page materially simpler than the internal billing system.

## AI Actions

The preferred customer-facing AI unit is an **AI action**: one meaningful AI outcome delivered to the user or performed for the workspace.

Examples that may count as one AI action:

- generate a reply
- summarize a conversation
- generate a social post
- adapt a post for another platform
- generate a comment response
- produce a knowledge-grounded answer
- run a user-requested analysis that produces a meaningful result

One AI action is not equal to one model call.

If generating a reply internally requires classification, retrieval, generation, and a safety/quality check, it can still be one billable action.

## Ambient Intelligence

Low-cost background intelligence may be included without consuming visible AI actions when economics permit.

Examples:

- language detection
- basic intent classification
- sentiment signal
- spam detection
- priority signal
- routing hints
- lightweight extraction used to improve the product workflow

This keeps Rezzy feeling intelligent even for customers who use little generative AI.

Whether an operation is free/included or billable is a product decision and may change as real cost data becomes available.

## Weighted / Expensive Operations

Some operations may eventually consume more than one AI action or use a separate clearly explained allowance if their marginal cost is materially different.

Likely examples:

- image generation
- video generation
- long-form or large-context analysis
- expensive autonomous workflows

Do not introduce weighting until real usage data shows that a flat action model creates material cost or abuse problems.

## AI Automations

Human-initiated assistance and autonomous work have different value.

### AI assistance

Examples:

- draft a reply
- summarize a thread
- improve text
- generate a post

Include this generously in the main paid plan.

### AI automation / autopilot

Examples:

- automatically classify a new comment and respond when policy permits
- automatically route high-intent leads
- automatically escalate negative sentiment
- automatically publish pre-approved scheduled content

Advanced unattended automation should be a higher-tier capability because it replaces ongoing labor rather than merely accelerating a user action.

## Overage

Prefer predictable overage or prepaid usage packs over immediate hard stops.

Example structure:

- plan includes N AI actions per month
- workspace receives clear usage warnings before the allowance is exhausted
- additional actions can be purchased as a pack or charged at a simple published rate
- administrators can optionally configure a monthly AI spend/usage cap

Do not advertise “unlimited AI” until abuse, cost distribution, and heavy-user economics are well understood.

## Internal Usage Accounting

The internal system should be more granular than customer pricing.

For every AI operation, record as appropriate:

- workspace ID
- user ID or automation actor when relevant
- product feature
- operation type
- provider
- model
- input usage
- output usage
- cached usage when available
- provider-reported or calculated monetary cost
- latency
- success/failure
- customer-visible action ID
- billable action quantity
- automation/run ID when applicable
- timestamp

The accounting model must support multiple internal model calls mapping to a single customer-visible AI action.

## Margin Monitoring

Track AI cost as a percentage of subscription revenue by workspace and by feature.

The purpose is to identify:

- features whose cost is disproportionate to their value
- workspaces whose usage pattern is structurally unprofitable
- opportunities for cheaper model routing or caching
- allowances that need adjustment
- high-value automation features that justify higher pricing

Do not optimize solely for the lowest AI cost. Quality failures in customer-facing replies can be more expensive than inference.

## Model Routing

Rezzy should choose the appropriate model for the job.

Use inexpensive models for simple classification/extraction when they meet quality requirements. Use stronger models for generation or reasoning where quality materially improves the customer outcome.

The customer buys Rezzy's result, not a specific underlying model, unless a future product tier explicitly promises otherwise.

## Pricing Page Rule

Keep public pricing comprehensible.

A paid plan should ideally be explainable with a few important limits, for example:

`5 users · 10 channels · 3,000 AI actions`

Do not surface a matrix of separate quotas for messages, comments, summaries, replies, posts, classifications, tokens, automations, and model types unless customers genuinely need those distinctions.

## Validation Before Final Pricing

Before treating prices or allowances as final, collect:

- average and P95 AI cost per active workspace
- cost per AI feature and operation
- AI actions per active user
- AI actions per handled conversation/comment
- infrastructure cost per workspace
- distribution of channel/message/comment volume
- percentage of customers using AI assistance
- percentage using automation
- willingness-to-pay feedback by team size and use case

The pricing architecture should be stable; the exact numbers should remain easy to tune.
