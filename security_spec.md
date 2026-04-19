# Firestore Security Specification

## Data Invariants
1. A user document must exist at `/users/{uid}` where `{uid}` matches the authenticated user's ID.
2. A user can only read and write their own document.
3. The `createdAt` field is immutable after creation.
4. The `uid` field must match the document ID.

## The "Dirty Dozen" Payloads (Rejected Cases)
1. **Unauthenticated Read**: Try to read a user profile without being logged in.
2. **Identity Spoofing**: User A trying to read User B's profile.
3. **Identity Poisoning**: Trying to create a user profile where the internal `uid` field does not match the document ID/Auth UID.
4. **Field Injection**: Adding a banned field like `isAdmin: true` during update.
5. **Schema Violation**: Setting `photoURL` to a 1MB string.
6. **Immutable Modification**: Attempting to change the `createdAt` timestamp.
7. **Type Mismatch**: Sending a boolean where a string (email) is expected.
8. **Invalid ID Format**: Using a document ID with special characters like `#` or `@`.
9. **Terminal State Break**: (N/A for simple profiles, but relevant if we had status).
10. **Resource Exhaustion**: Sending a name longer than 128 characters.
11. **Provider Spoofing**: Authenticated via Phone but trying to set provider to `google` (though this is client-side data, we can validate UID/Auth context).
12. **Blanket List Read**: Authenticated user trying to list ALL users without a filter.
