# Calling workbook and digital handoff

## Input
The private Google workbook configured by CALLING_SHEET_ID. Prospects is a read-only D1 mirror. Call log contains one event per call, keyed by Call ID and exact Lead ID. Preserve the existing property cutoff, immutable do-not-contact status and company suppression. A phone number appearing in the workbook is not calling clearance.

## Process
- A dedicated Worker with no HTTP surface runs every five minutes, only when CALLING_SYNC_ENABLED is true. Store its dedicated Google service-account key as a Worker secret. Share only the intended workbook with that identity. New credentials/access require operator confirmation.
- Read fixed tab names and validate headers before writing. Process at most 20 approved, unprocessed rows per run. At 999 call entries, stop and require archive/capacity review. Existing Synced rows are immutable; use a new Call ID for corrections.
- Extract PDF form fields with scripts/extract-call-pdfs.py. A connected assistant validates exact lead IDs and existing call IDs, then appends review rows. AI extraction is not approval. The operator selects Yes in Approved to sync after reviewing values.
- Validate IDs, caller, outcome, timezone-bearing ISO call time, phone and follow-up date. Missing/invalid values stay unresolved. A call outcome does not establish phone verification.
- D1 remains authoritative. Apply each call only at the prospect version in the workbook. Store its complete payload, append notes/history, increment the version, and apply suppression in one transaction. An identical Call ID replay is a no-op; a different payload with that ID is rejected.
- Preserve previous notes. If appending exceeds the editor's 4000-character limit, hold for review rather than truncate. DNC remains allowed for excluded properties and cannot be reversed by the importer.
- Recheck call identity and inputs before acknowledgement. Refresh the protected Prospects mirror after processing. Conflicts stay in Error until the operator reviews newer data, fixes the entry and clears Sync status to retry. Do not sort/edit a submitted row while processing.
- Do not create inquiries, quotes, calendar appointments, customer messages or sales. Appointment details are notes, not calendar bookings.

## Output
Private call ledger, append-only prospect history, current status/notes/follow-up in the existing Command Center, and explicit per-call sync results in Sheets. Logs contain aggregate counts or generic errors only.

## Stop conditions
Missing configuration, changed headers, duplicate IDs, invalid data, version conflict, property hold, DNC reversal, field limit or provider failure. Keep setup-pending visible until a synthetic live test passes.

## Completion
Run npm run test:skip-trace-calls, npm run test:skip-trace, npm run test:all and npm run build. Deploy only after account setup, set the secret and workbook ID, protect the source mirror, then enable the schedule. Verify a synthetic call and duplicate retry. A PR alone does not activate Google access or the Worker.

## Operating the deployed service
The checked-in configuration defaults to disabled and an empty workbook ID. Production deployments must explicitly supply the intended CALLING_SHEET_ID and CALLING_SYNC_ENABLED=true overrides; do not deploy the default configuration over an active service. Wrangler preserves the existing Worker secret. Never commit a service-account key or copy it into a cell or browser-delivered script.

Verify the last-sync timestamp on Start here, each submitted call's Synced timestamp, and the corresponding D1 prospect/history. Existing Command Center pages display the saved values after Load / refresh prospects. A failed browser sign-in does not establish a database failure; distinguish direct D1 verification from authenticated UI verification.

