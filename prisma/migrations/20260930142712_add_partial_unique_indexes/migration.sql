-- A phone number belongs to at most one LIVE account. Deleting an account
-- soft-deletes it, which must free the number for a fresh signup — a plain
-- UNIQUE would keep it reserved forever and make re-signup fail.
CREATE UNIQUE INDEX users_mobile_unique_active
  ON "User" ("mobileNumber") WHERE "isDeleted" = false;

-- Same for the username, for the same reason: a deleted account must not
-- hold a name hostage.
CREATE UNIQUE INDEX users_username_unique_active
  ON "User" ("userName") WHERE "isDeleted" = false;