---
name: tenant-isolation-review
description: Review a new or changed backend route/query for cross-tenant data leakage (IDOR) — use whenever a route takes an :id/:networkId/:enterpriseId/:pharmacyId/:groupId param and queries the database by it, whenever touching hospital-network, enterprise/farm, or pharmacy data, or when the user asks for a security review of multi-tenant code. This platform has a documented history of exactly this bug class (15 cross-tenant isolation bugs found in one audit), so treat any new tenant-scoped endpoint as guilty until proven innocent.
---

# Tenant-isolation review

This platform has four kinds of tenant: a hospital network, an enterprise/farm, a pharmacy, and
an animal group (herd/flock). Every one of them has, at some point, had a real cross-tenant leak
shipped — a user from Network A reading or writing Network B's data because a route trusted the
`:id` in the URL without checking who it belongs to. That's not a hypothetical risk to design
against in the abstract; it's the single most common real bug class in this codebase's history.

## The shape of the bug, every time

```ts
// WRONG — whoever is logged in can read ANY network's members by guessing the id
router.get('/hospital-networks/:id/members', authMiddleware, async (req, res) => {
  const members = await db.query('SELECT * FROM hospital_network_members WHERE network_id = $1', [req.params.id]);
  res.json(members.rows);
});
```

`authMiddleware` only proves the caller is *someone*. It says nothing about whether they belong
to *this* network. The fix is always the same shape: resolve the tenant id from the URL, check
the caller's membership in it (or platform-admin override), and only then run the real query —
and if they're not a member, respond **404**, not 403, so an outsider can't even confirm the
resource exists.

## Don't reinvent the check — copy the canonical one for that tenant type

This repo already has a guard for each tenant type. Use the existing one; don't write a new
ad-hoc membership query, because every ad-hoc version that's shipped has eventually had a gap the
canonical one already closed.

| Tenant type | Canonical guard | Where |
|---|---|---|
| Hospital network | `resolveNetworkAccess()` / `requireNetworkAccess()` | `backend/src/middleware/networkAccess.ts` |
| Enterprise / animal group | `ensureGroupAccess()` | `backend/src/routes/enterprise-farm.routes.ts` (exported) |
| Pharmacy | `guardPharmacy()` / `guardNetworkPharmacy()` | `backend/src/routes/pharmacy.routes.ts` (local helpers) |
| Animal / enterprise data isolation | `requireAnimalAccess()` / `requireEnterpriseAccess()` / `checkAnimalAccess()` | `backend/src/middleware/hospitalDataIsolation.ts` |

**Known gap, don't assume the opposite:** roughly two dozen call sites across the app check
`is_active` on a network membership without also checking `valid_until`, so a membership grant
that has expired still passes. `resolveNetworkAccess()` itself handles this correctly — anything
that duplicates the check by hand instead of calling it may not. When you see a hand-rolled
`WHERE is_active = true` membership check, that's a signal to look harder, not reassurance.

## Checklist for any route you're adding or reviewing

- [ ] Does every handler that takes a tenant-scoped `:id`-shaped param call the canonical guard
      for that tenant type **before** running the real query, not after?
- [ ] On a **list/bulk** endpoint, is the tenant filter *in the SQL* (`WHERE network_id = $1`),
      not "fetch everything, the UI only shows the right ones"? A missing SQL filter leaks data
      through the API even if the UI never displays it.
- [ ] Does a non-member get **404**, not 403? 403 confirms the resource exists; for anything
      tenant-scoped that's itself a (minor) information leak.
- [ ] Does a platform `admin` override correctly, and is that override explicit in the code
      rather than accidental (e.g. a role check that happens to also match admin)?
- [ ] If the membership check reads `is_active`, does it also honor `valid_until` the way
      `resolveNetworkAccess()` does — or is this one of the ~24 sites that doesn't?
- [ ] For a resource that can move between tenants (e.g. a branch hospital changing networks,
      an animal being enrolled in a new network), is the check against the resource's *current*
      tenant, not a cached or stale one?

## How to actually find the bug, not just read past it

Static checks (`tsc`, `vitest`) cannot see this class of bug — they don't throw, the code is
type-correct and runs fine for the tenant it was tested with. What found all 15 historical bugs
was **cross-referencing**: trace the `:id` param from the route definition through to the SQL
that uses it, and ask "what stops someone from supplying a different id here." If you're
reviewing, actually do that trace for each tenant-scoped route — don't just skim for the
presence of `authMiddleware` and assume it's covered, since that's exactly the mistake that
shipped the original bugs.

## If what you're touching is hospital-network permission or visibility code specifically

That's a step beyond an ordinary tenant-isolation review: it's change-protected, and this skill
is not a substitute for the approval step. Get explicit sign-off before writing code there (see
`CLAUDE.md`'s note on the network-hospital zone), then use this checklist during the review.
