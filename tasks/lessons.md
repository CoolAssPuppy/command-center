# Lessons

Patterns learned during the build, so mistakes are not repeated. Reviewed at the start of each loop iteration.

## Process

- Verify before asserting. The Safari new tab override was first claimed impossible from memory and turned out to be supported. Check primary sources before stating a hard constraint.
- App Groups are team-scoped. They cannot be the cross-developer transport. The open platform uses the local endpoint and a well-known directory instead.

## Testing

- Compute expected numeric values (time-zone offsets, dates) independently before writing the assertion. A red test caught a hand-done offset arithmetic slip in P1.4; the code was correct. Trust the red, then verify which side is wrong.
- Under strict TS plus type-checked ESLint, do not assign a closure-captured variable to drive later control flow. The compiler cannot see the assignment, narrows the variable to its initial type, and a later guard collapses to `never` (hit in P1.8 fillTemplate). Pre-scan or compute the value before the callback instead.
- In DOM render tests, attach the host node to document.body (and clear it in afterEach with replaceChildren, never innerHTML). getByText throws on miss so it already proves existence, but toBeInTheDocument additionally requires the node be attached to the document; a detached host fails it (hit in P1.9).
- Keep a buildable entry (index.html + src/main.ts) so `npm run build` stays green every iteration; vite needs an HTML entry even while the real shell is unwritten.
- A needs_auth reconnect must not reuse an action that requires a feed-supplied param (like open?url={url}); with no url it silently never fires. Launch the provider via a parameterless commandcenter://openProvider route instead. Design-review actions for their required params before wiring a button to them.
- To open a plain web link, use a commandcenter://open route with the url as a param, not a urlTemplate of `{url}`. The action resolver URL-encodes every param so it cannot break out, and an encoded https value (https%3A%2F%2F...) is not a navigable URL. The native app decodes the route param and opens it in the browser.

## Architecture invariants to never violate

- Providers declare, themes render. No provider ships HTML, CSS, JS, or pixels. No theme fetches data or holds a token.
- No OAuth token or client secret ever crosses an app boundary or enters the shared container or the endpoint.
- All feed text is rendered as text, never as HTML. No innerHTML with provider content.
- Every action URL is validated against a scheme and host allowlist before opening.
- Every feed carries a required glance line.
