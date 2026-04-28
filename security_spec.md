# Security Spec for KaoJiang Queue Tracker

## 1. Data Invariants
- A QueueLog must have a valid city (Beijing, Xi'an, Shanghai).
- QueueCount must be a non-negative integer.
- The uploadTime must be the current server time during creation.
- Users can create logs but only if they are authenticated.
- For this app, since it's a tool for specific monitoring, we'll allow all authenticated users to read and create, but we'll enforce strict schema validation.

## 2. Dirty Dozen Payloads (Rejection Tests)
1. **Empty Payload**: `{}` -> Denied (Missing required fields).
2. **Invalid City**: `{"city": "Tokyo", ...}` -> Denied (City not in allowed list).
3. **Negative Queue**: `{"queueCount": -1, ...}` -> Denied (Must be >= 0).
4. **Huge String**: `{"storeName": "A".repeat(2000), ...}` -> Denied (Size limit).
5. **Spoofed Upload Time**: `{"uploadTime": "2020-01-01T00:00:00Z", ...}` -> Denied (Must be server timestamp).
6. **Malicious ID Injection**: Trying to create a document with ID `../../secrets` -> Denied by `isValidId`.
7. **Type Mismatch**: `{"queueCount": "ten", ...}` -> Denied (Must be integer).
8. **Missing Table Type**: `{"city": "Beijing", "storeName": "Store A", "queueCount": 5}` -> Denied (Missing tableType).
9. **Admin Field Injection**: Adding `isAdmin: true` to a log -> Denied by strict schema.
10. **Unauthorized Update**: Attempting to update a log's `city` after creation -> Denied (Immutable fields).
11. **Huge Queue Number**: `{"queueCount": 1000000}` -> Denied (Upper bound check).
12. **Null Values**: `{"city": null}` -> Denied (Type check).

## 3. Implementation Patterns
- Use `isValidQueueLog` helper.
- Enforce server timestamp for `uploadTime`.
- Restrict queries to prevent scraping if needed, but here researchers likely need all data.
