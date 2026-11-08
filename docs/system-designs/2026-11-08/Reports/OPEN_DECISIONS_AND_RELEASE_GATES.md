# Open decisions and release gates — 8 November 2026

The following are intentionally **not** silently resolved by this pack.

1. **Final brand palette.** Theme Lab candidates are evaluation-only; production uses semantic tokens until founder approval.
2. **Seller Stories production contract.** UX direction is approved, but storage/API/events/media retention/notification/analytics contract is not yet closed.
3. **Courier MOBILE executable contract.** High-level design is already MOBILE; API/auth/permission schemas and mode-eligibility/bootstrap must be reissued to match it before Courier production features.
4. **Generated API client exports.** Mobile must not hand-write duplicate DTOs; generated OpenAPI path/types need a clean shared export.
5. **Human Amharic translation.** Technical rendering/key parity is validated; user-facing Amharic remains gated on human review.
6. **Repository-health debt.** Existing migrate/date/load/browser-smoke failures are engineering-health work, not design authority changes.
7. **Touch target design token.** Current shared minimum remains 44 dp; any move to 48 dp is a design-system decision.
8. **Native build workstation path.** Local Windows native builds require a short NTFS checkout or EAS; this is environment architecture, not product behavior.
