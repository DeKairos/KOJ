import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

export type AppRole = User["role"];

export async function requireAuthenticatedUser(): Promise<User> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Authentication required");
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!clerkUser || !email) {
    throw new Error("Authenticated user has no primary email");
  }

  const username = clerkUser.username ?? clerkUser.firstName ?? email.split("@")[0];
  const [user] = await db
    .insert(users)
    .values({ clerkId: userId, username, email })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { username, email, updatedAt: new Date() },
    })
    .returning();

  if (!user) {
    throw new Error("Unable to load application user");
  }

  return user;
}

export async function requireRole(allowedRoles: readonly AppRole[]): Promise<User> {
  const user = await requireAuthenticatedUser();
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Insufficient permissions");
  }

  return user;
}

export async function getApplicationUser(clerkId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  return user;
}
