# Security Specification - CookGenix

## 1. Data Invariants
- A Recipe document MUST have a `user_id` matching the authenticated user's UID.
- A User document MUST match the authenticated user's UID.
- Feedback entries MUST include a valid `user_id` and a rating between 1 and 5.
- Users can only read and write their own recipes.
- Users can create feedback but not read or modify existing feedback (only admins can read).

## 2. The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Spoofing**: Creating a recipe with a different `user_id`.
   ```json
   { "name": "Fake", "user_id": "other_user_123", "savedAt": "2026-04-30T10:00:00Z" }
   ```
2. **Unauthorized Access**: Reading another user's recipe.
   `GET /recipes/some_other_recipe_id`
3. **Privilege Escalation**: Modifying the `isAdmin` flag in a user profile (if it existed).
4. **Metadata Poisoning**: Changing `createdAt` on an existing user profile during update.
5. **Collection Scraping**: Listing all recipes globally.
   `LIST /recipes`
6. **Shadow Fields**: Adding an `isVerified` field to a recipe to bypass filters.
7. **Invalid Type**: Sending a string for a rating (should be integer).
8. **Resource Exhaustion**: Sending a 2MB string as a recipe name.
9. **Orphaned Writes**: Creating a feedback entry without a `user_id`.
10. **State Skipping**: Manually setting a `completed` status on a multi-stage process prematurely.
11. **Email Spoofing**: Setting `email` to an admin email without verification.
12. **Unauthorized Deletion**: Deleting someone else's recipe.

## 3. Test Runner Strategy
The following `firestore.rules` will be tested using the Firestore Emulator or evaluated against these invariants.
