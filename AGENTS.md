<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Firestore database namespace

Before creating, renaming, reading, or writing a Firestore collection, read and
follow `.agent/rules/database-rules/rules.md`. POS-owned top-level collections
must use the `pos_` namespace so they cannot collide with `bduck-system`.
