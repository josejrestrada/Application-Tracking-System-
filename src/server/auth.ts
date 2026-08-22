import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { nextPrefixedId } from "./ids";
import { toUser, type UserRow } from "./mappers";
import type { HubLocation, SessionUser } from "@/lib/types";

export function findUserByEmail(email: string) {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as UserRow | undefined;
  return row;
}

export function authenticate(email: string, password: string) {
  const row = findUserByEmail(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return null;
  }
  return toUser(row);
}

export function registerUser(input: {
  name: string;
  email: string;
  password: string;
  hub?: HubLocation;
}): { ok: true; user: SessionUser } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  if (findUserByEmail(email)) {
    return { ok: false, error: "An account with that email already exists." };
  }
  const db = getDb();
  const id = nextPrefixedId(db, "users", "u");
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, hub)
     VALUES (?, ?, ?, ?, 'recruiter', ?)`
  ).run(
    id,
    input.name.trim() || "New Recruiter",
    email,
    bcrypt.hashSync(input.password || "demo", 10),
    input.hub || "Pune"
  );
  const user = toUser(findUserByEmail(email)!);
  return { ok: true, user };
}
