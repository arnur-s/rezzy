#!/usr/bin/env bash
# Two-session race tests for the membership RPCs.
#
# supabase test db runs one session per file inside a transaction it rolls
# back, so the interleavings these functions are locked against cannot be
# observed there. Each psql below is an independent backend against the same
# local database, which is what makes the lock testable at all.
#
# These COMMIT. Fixtures use the 70000000- id namespace, owned by this file
# alone, and are dropped before and after every run so a failed run cannot
# poison the next one.
set -uo pipefail

# The container name is derived from the local checkout's directory name
# (docker-compose project naming), so it varies between machines and CI --
# it is not necessarily "supabase_db_cms" outside this worktree. Resolve it
# from the running containers instead of hardcoding it.
DB_CONTAINER=$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n1)
if [ -z "$DB_CONTAINER" ]; then
  echo "race.sh: no running container matching 'supabase_db_*' found -- is 'supabase start' (or 'pnpm supabase:start') running?" >&2
  exit 1
fi

DB="docker exec -i $DB_CONTAINER psql -U postgres -d postgres -qtAX"
WS=70000000-0000-4000-8000-000000000001
OWNER_A=70000000-0000-4000-8000-000000000011
OWNER_B=70000000-0000-4000-8000-000000000012
ADMIN=70000000-0000-4000-8000-000000000013
TARGET=70000000-0000-4000-8000-000000000014
INVITEE=70000000-0000-4000-8000-000000000015

fail=0
check() { # check <description> <actual> <expected>
  if [ "$2" = "$3" ]; then
    echo "ok - $1"
  else
    echo "not ok - $1 (got '$2', want '$3')"
    fail=1
  fi
}

claims() { echo "set local role authenticated; set local request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\"}';"; }

teardown() {
  $DB -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
delete from public.workspace_invitations where workspace_id = '$WS';
delete from public.workspace_members where workspace_id = '$WS';
delete from public.workspaces where id = '$WS';
delete from auth.users where id in ('$OWNER_A','$OWNER_B','$ADMIN','$TARGET','$INVITEE');
SQL
}

seed() {
  teardown
  $DB -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (id, email, raw_user_meta_data) values
  ('$OWNER_A', 'race-owner-a@example.com', '{"full_name":"Race Owner A"}'::jsonb),
  ('$OWNER_B', 'race-owner-b@example.com', '{"full_name":"Race Owner B"}'::jsonb),
  ('$ADMIN', 'race-admin@example.com', '{"full_name":"Race Admin"}'::jsonb),
  ('$TARGET', 'race-target@example.com', '{"full_name":"Race Target"}'::jsonb),
  ('$INVITEE', 'race-invitee@example.com', '{"full_name":"Race Invitee"}'::jsonb);

insert into public.workspaces (id, name, created_by)
values ('$WS', 'Race Workspace', '$OWNER_A');
-- on_workspace_created seated OWNER_A as owner.

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('$WS', '$OWNER_B', 'owner'),
  ('$WS', '$ADMIN', 'admin'),
  ('$WS', '$TARGET', 'member');
SQL
}

# ── Race 1: two concurrent demotions cannot reach zero owners ────────────────
#
# Without the roster lock both sessions read two owners, both pass the
# last-owner check, and both commit — leaving none.
seed
$DB -c "begin; $(claims $OWNER_A) select public.update_workspace_member_role('$WS','$OWNER_A','member'); select pg_sleep(2); commit;" >/dev/null 2>&1 &
sleep 1
b_err=$($DB -c "begin; $(claims $OWNER_B) select public.update_workspace_member_role('$WS','$OWNER_B','member'); commit;" 2>&1 | grep -c 'LAST_OWNER')
wait
owners=$($DB -c "select count(*) from public.workspace_members where workspace_id='$WS' and role='owner';")
check "concurrent demotions leave at least one owner" "$owners" "1"
check "the second demotion is refused with LAST_OWNER" "$b_err" "1"
teardown

# ── Race 1b: two concurrent self-removals cannot reach zero owners ──────────
#
# remove_workspace_member's roster lock is a separate "perform ... for
# update" statement from update_workspace_member_role's -- stripping only
# this one previously left the whole race suite green, because nothing here
# exercised it. Same shape as Race 1, through the leaving path instead of the
# demotion path: two owners leave (remove themselves) at the same time.
# Without this function's own lock, both read two owners, both pass the
# last-owner check, and both commit -- zero owners left.
seed
$DB -c "begin; $(claims $OWNER_A) select public.remove_workspace_member('$WS','$OWNER_A'); select pg_sleep(2); commit;" >/dev/null 2>&1 &
sleep 1
b_err=$($DB -c "begin; $(claims $OWNER_B) select public.remove_workspace_member('$WS','$OWNER_B'); commit;" 2>&1 | grep -c 'LAST_OWNER')
wait
owners=$($DB -c "select count(*) from public.workspace_members where workspace_id='$WS' and role='owner';")
check "concurrent self-removals leave at least one owner" "$owners" "1"
check "the second removal is refused with LAST_OWNER" "$b_err" "1"
teardown

# ── Race 2: a concurrent promotion cannot slip under an admin's demotion ────
#
# Session A (an owner) promotes $TARGET to owner and holds the transaction
# open. Session B (the admin) tries to move $TARGET to 'admin' while A is
# still inside its lock.
#
# B's role target ('admin') is deliberately different from $TARGET's pre-race
# role ('member'): if it matched, the function's "no-op when the role is
# already what was asked for" branch would return before ever reaching the
# update, and the interleaving below would go unexercised. With that branch
# avoided, an unlocked read lets B observe the pre-promotion role ('member'),
# pass every authorization check as an ordinary admin action, then block on
# Postgres's own row lock for the final UPDATE statement -- not on our
# roster lock, since it doesn't exist in this configuration. Once A commits,
# B's UPDATE re-acquires the row, but its WHERE clause never re-checks role,
# so it blindly overwrites A's freshly committed 'owner' with 'admin': an
# admin action landing on an owner's row, exactly what
# OWNER_ROLE_REQUIRES_OWNER exists to stop. With the roster lock restored, B
# blocks earlier -- before it ever reads the target's role -- and once
# unblocked it re-reads $TARGET as 'owner' and is refused.
seed
$DB -c "begin; $(claims $OWNER_A) select public.update_workspace_member_role('$WS','$TARGET','owner'); select pg_sleep(2); commit;" >/dev/null 2>&1 &
sleep 1
b_err=$($DB -c "begin; $(claims $ADMIN) select public.update_workspace_member_role('$WS','$TARGET','admin'); commit;" 2>&1 | grep -c 'OWNER_ROLE_REQUIRES_OWNER')
wait
target_role=$($DB -c "select role from public.workspace_members where workspace_id='$WS' and user_id='$TARGET';")
check "the target is still an owner" "$target_role" "owner"
check "the admin's demotion is refused with OWNER_ROLE_REQUIRES_OWNER" "$b_err" "1"
teardown

# ── Race 3: two concurrent invitations for the same address cannot collide ──
#
# invite_workspace_member relies on ON CONFLICT ... DO UPDATE inferring
# workspace_invitations_pending_key, in one statement, rather than a
# read-then-write. Two truly concurrent callers must resolve to exactly one
# pending row and neither may surface a raw 23505.
seed
# Backgrounded command substitution runs the assignment in a subshell, so the
# parent never sees $(...) captured that way — each side writes to its own
# file instead, read back after both finish.
race3_a=$(mktemp)
race3_b=$(mktemp)
$DB -c "begin; $(claims $OWNER_A) select public.invite_workspace_member('$WS','race-invitee@example.com','member'); commit;" >"$race3_a" 2>&1 &
$DB -c "begin; $(claims $OWNER_B) select public.invite_workspace_member('$WS','race-invitee@example.com','admin'); commit;" >"$race3_b" 2>&1 &
wait
pending=$($DB -c "select count(*) from public.workspace_invitations where workspace_id='$WS' and invited_email='race-invitee@example.com' and status='pending';")
check "exactly one pending invitation exists" "$pending" "1"
a_23505=$(grep -c '23505' "$race3_a")
b_23505=$(grep -c '23505' "$race3_b")
check "neither concurrent invite surfaces a raw unique violation" "$((a_23505 + b_23505))" "0"
rm -f "$race3_a" "$race3_b"
teardown

if [ "$fail" -ne 0 ]; then echo "FAILED"; exit 1; fi
echo "all race tests passed"
