# Lessons

Patterns learned during the build, so mistakes are not repeated. Reviewed at the start of each loop iteration.

## Process

- Verify before asserting. The Safari new tab override was first claimed impossible from memory and turned out to be supported. Check primary sources before stating a hard constraint.
- App Groups are team-scoped. They cannot be the cross-developer transport. The open platform uses the local endpoint and a well-known directory instead.

## Testing

- Compute expected numeric values (time-zone offsets, dates) independently before writing the assertion. A red test caught a hand-done offset arithmetic slip in P1.4; the code was correct. Trust the red, then verify which side is wrong.

## Architecture invariants to never violate

- Providers declare, themes render. No provider ships HTML, CSS, JS, or pixels. No theme fetches data or holds a token.
- No OAuth token or client secret ever crosses an app boundary or enters the shared container or the endpoint.
- All feed text is rendered as text, never as HTML. No innerHTML with provider content.
- Every action URL is validated against a scheme and host allowlist before opening.
- Every feed carries a required glance line.
