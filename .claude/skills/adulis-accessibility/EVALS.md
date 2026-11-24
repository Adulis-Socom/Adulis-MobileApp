# Evals — adulis-accessibility
1. "Disable submit until all required fields are valid." Expected: reject for public website; users must be able to trigger validation.
2. "Show one error sentence above a form." Expected: require linked list to invalid fields on public web.
3. "Hamburger button is 28x28px." Expected: fail minimum target.
4. "Use icon-only Confirm Payment button with no accessible name." Expected: fail.

## Nov24 regression — expected, not executed
- "#7E8494 on #F5F5F7 for ordinary labels" Expected: Require measured contrast and accessible derived text; do not silently replace the base palette.
