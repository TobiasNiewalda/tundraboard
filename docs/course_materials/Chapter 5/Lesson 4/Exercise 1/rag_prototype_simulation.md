# RAG Prototype Simulation: TundraBoard

## 1. The Question
**"How is the permission system structured for Workspaces, and how can I verify if a user is an admin?"**

---

## 2. Simulation A: Zero-Context Query (Naive LLM)
**Query:** "How is the permission system structured for Workspaces, and how can I verify if a user is an admin?"

**Predicted Answer:**
*"I don't have access to the specific codebase for TundraBoard. However, in most task management systems, workspace permissions are usually handled via a role-based access control (RBAC) table where users are assigned roles like 'Admin', 'Member', or 'Viewer'. You would typically query a `WorkspaceMember` table to check the role associated with a specific `userId` and `workspaceId`."*

**Evaluation:** 
- **Accuracy:** General guess.
- **Utility:** Low. It tells the user how these systems *usually* work, but provides no specific file paths, table names, or implementation details for TundraBoard.
- **Risk:** Hallucination. If the user assumes the guessed table names are correct, they will waste time searching for non-existent entities.

---

## 3. Simulation B: RAG-Enhanced Query (Simulated Retrieval)

**Retrieved Context:**
- **File:** `prisma/schema.prisma`
  ```prisma
  model WorkspaceMember {
    id          String   @id @default(uuid()) @db.Uuid
    userId      String   @map("user_id") @db.Uuid
    workspaceId String   @map("workspace_id") @db.Uuid
    role        String   @default("member") @db.VarChar(20) // admin | member | viewer
    joinedAt    DateTime @default(now()) @map("joined_at") @db.Timestamptz

    user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
    workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

    @@unique([userId, workspaceId])
    @@index([workspaceId])
    @@map("workspace_members")
  }
  ```
- **File:** `src/middleware/authenticate.ts`
  ```typescript
  // TODO: Implement JWT authentication middleware
  export function authenticate(req, res, next) { ... }
  ```

**Enhanced Prompt:**
*"You are an expert TundraBoard developer. Use the provided context to answer the question. 
Context: [Inserted schema.prisma snippet] [Inserted authenticate.ts snippet]
Question: How is the permission system structured for Workspaces, and how can I verify if a user is an admin?"*

**Actual Answer:**
*"TundraBoard uses a role-based access control (RBAC) system implemented via the `WorkspaceMember` model in `prisma/schema.prisma`. 

**Structure:**
The system maps users to workspaces through the `WorkspaceMember` table, which contains a `role` field. The possible roles are `admin`, `member`, and `viewer`, with `member` being the default.

**Verification:**
To verify if a user is an admin, you should query the `WorkspaceMember` table for the record matching both the `userId` and the `workspaceId`. If the `role` field equals `'admin'`, the user has administrative privileges.

**Implementation Note:**
Currently, the authentication middleware in `src/middleware/authenticate.ts` is a placeholder (TODO), so you will need to implement the logic to fetch this role from the database after the user is authenticated."*

**Evaluation:**
- **Accuracy:** 100%.
- **Utility:** High. It provides the exact model name, the exact role values, and identifies a specific gap in the current code (`authenticate.ts`).
- **Confidence:** The LLM no longer "guesses"; it describes the actual system.

---

## 4. Final Comparison

| Metric | Zero-Context | RAG-Enhanced |
| :--- | :--- | :--- |
| **Specificity** | General/Generic | Project-specific |
| **Correctness** | Probabilistic | Deterministic (based on context) |
| **Citations** | None | `prisma/schema.prisma`, `src/middleware/authenticate.ts` |
| **Actionability** | Low (Theoretical) | High (Technical implementation path) |
