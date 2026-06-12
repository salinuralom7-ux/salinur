# 3 — Realtime Database: Chat & Presence

Why RTDB for chat while Firestore is the system of record: chat is write-heavy and
billed per-GB on RTDB vs per-operation on Firestore. A 50-message conversation costs
~100 Firestore writes but ~10 KB of RTDB bandwidth. RTDB also gives free
`onDisconnect()` presence.

## Structure

```
rtdb-root/
├── chats/
│   └── {conversationId}/                  // `${vendorId}_${customerId}` — same ID as Firestore inbox doc
│       └── {pushId}/                      // RTDB push IDs sort chronologically
│           ├── senderId: "uid"
│           ├── text: "Can you do 8-hour coverage?"
│           ├── type: "text" | "image" | "quote"
│           ├── imageUrl: "..."            // type=image: Storage URL (never base64)
│           ├── ts: 1718450000000          // set with ServerValue.TIMESTAMP
│           └── read: false
│
├── typing/
│   └── {conversationId}/
│       └── {uid}: true                    // removed by onDisconnect()
│
└── presence/
    └── {uid}/
        ├── online: true
        └── lastSeen: 1718450000000
```

## Client rules of the road

- **Send**: push to `chats/{cid}`, then update the Firestore inbox doc
  (`lastMessage`, `lastMessageAt`, increment recipient's `unread`). The
  `onChatMessage` Cloud Function (04) sends the push notification.
- **Listen**: `query(ref(db, 'chats/'+cid), limitToLast(50))`; paginate older
  messages with `endBefore(...)`.
- **Presence**: on connect, set `presence/{uid}/online = true` and register
  `onDisconnect().set({ online:false, lastSeen: ServerValue.TIMESTAMP })`.
- **Typing**: set `typing/{cid}/{uid} = true` (debounced), `onDisconnect().remove()`.

## Retention & cost control

- A scheduled function (`archiveOldChats`, monthly) moves messages older than
  6 months to a Cloud Storage JSON archive and deletes them from RTDB.
  Keeps the RTDB under the 1 GB free tier far longer.
- Images go to Cloud Storage `chat/{conversationId}/...`; the message holds the URL.

## Conversation ID rule

Always `${vendorId}_${customerId}` (vendor first). Both apps compute it the same
way, so a conversation is found or created without a lookup query.
