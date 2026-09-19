import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { rankySessions } from "@/db/schema";

type CreateRankySessionInput = {
  projectId: string;
  userId: string;
};

async function createSession(input: CreateRankySessionInput) {
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(rankySessions)
    .values({
      id,
      projectId: input.projectId,
      userId: input.userId,
    })
    .returning();
  return row;
}

// Callers must have already authorized the project (requireProjectContext).
// Scoped to userId so a project member only sees their own sessions.
async function listSessionsForProject(projectId: string, userId: string) {
  return db
    .select({
      id: rankySessions.id,
      title: rankySessions.title,
      createdAt: rankySessions.createdAt,
      updatedAt: rankySessions.updatedAt,
    })
    .from(rankySessions)
    .where(
      and(
        eq(rankySessions.projectId, projectId),
        eq(rankySessions.userId, userId),
        isNull(rankySessions.archivedAt),
      ),
    )
    .orderBy(desc(rankySessions.updatedAt), desc(rankySessions.id));
}

// Look up a session by id alone (no scoping). Only for the RankyChatAgent
// Durable Object, whose connections are authorized in the Worker before they
// reach the DO; the DO derives its project/user (and, via the project, its
// org) from this row.
async function getSessionById(id: string) {
  const [row] = await db
    .select()
    .from(rankySessions)
    .where(eq(rankySessions.id, id))
    .limit(1);
  return row ?? null;
}

// Look up a caller's own active session by id, scoped to userId so one org
// member can't act on another's session. Excludes archived sessions so callers
// treat them like deleted ones (connection refused / not archivable) even
// though the row and DO transcript are kept. Callers must still check access to
// row.projectId via the canonical project-access path
// (ProjectRepository.getProjectForOrganization) before acting on the session.
async function getActiveSession(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(rankySessions)
    .where(
      and(
        eq(rankySessions.id, id),
        eq(rankySessions.userId, userId),
        isNull(rankySessions.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

// Set the title from the first user message and bump updatedAt so the session
// sorts to the top of the side-panel. Called by the DO on the first turn.
async function setTitle(id: string, title: string) {
  await db
    .update(rankySessions)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(rankySessions.id, id));
}

async function touch(id: string) {
  await db
    .update(rankySessions)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(rankySessions.id, id));
}

// Callers must have already authorized the session's project.
async function archiveSession(id: string) {
  await db
    .update(rankySessions)
    .set({ archivedAt: new Date().toISOString() })
    .where(eq(rankySessions.id, id));
}

export const RankySessionRepository = {
  createSession,
  listSessionsForProject,
  getSessionById,
  getActiveSession,
  setTitle,
  touch,
  archiveSession,
} as const;
