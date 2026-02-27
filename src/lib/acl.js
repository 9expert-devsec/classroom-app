// src/lib/acl.js

export const ROLE = {
  SA: "SA",
  OPS: "OPS",
  EVT: "EVT",
};

export const ROLE_LABELS = {
  SA: "Super Admin",
  OPS: "Staff / Ops",
  EVT: "Event Specialist",
};

export const PERM = {
  DASHBOARD_VIEW: "dashboard.view",

  CLASSES_READ: "classes.read",
  CLASSES_WRITE: "classes.write",
  CLASSES_IMPORT: "classes.import",

  FOOD_READ: "food.read",
  FOOD_WRITE: "food.write",
  FOOD_REPORT: "food.report",

  EVENTS_READ: "events.read",
  EVENTS_WRITE: "events.write",
  EVENTS_IMPORT: "events.import",
  EVENTS_CHECKIN: "events.checkin",

  EVENTS_SETTINGS_READ: "events.settings.read",
  EVENTS_SETTINGS_WRITE: "events.settings.write",
  EVENTS_SETTINGS_DELETE: "events.settings.delete",

  ACCOUNTS_MANAGE: "accounts.manage",
  MY_ACCOUNT: "my.account",

  AUDIT_READ: "audit.read",
};

export const ROLE_PERMS = {
  [ROLE.SA]: Object.values(PERM),

  [ROLE.OPS]: [
    PERM.DASHBOARD_VIEW,

    PERM.CLASSES_READ,
    PERM.CLASSES_WRITE,
    PERM.CLASSES_IMPORT,

    PERM.FOOD_READ,
    PERM.FOOD_WRITE,
    PERM.FOOD_REPORT,

    PERM.EVENTS_READ,
    PERM.EVENTS_WRITE,
    PERM.EVENTS_IMPORT,
    PERM.EVENTS_CHECKIN,

    PERM.EVENTS_SETTINGS_READ,

    PERM.AUDIT_READ,
    PERM.MY_ACCOUNT,
  ],

  [ROLE.EVT]: [
    PERM.DASHBOARD_VIEW,

    PERM.CLASSES_READ,

    PERM.EVENTS_READ,
    PERM.EVENTS_WRITE,
    PERM.EVENTS_IMPORT,
    PERM.EVENTS_CHECKIN,

    PERM.EVENTS_SETTINGS_READ,
    PERM.EVENTS_SETTINGS_WRITE,
    PERM.EVENTS_SETTINGS_DELETE,

    PERM.AUDIT_READ,
    PERM.MY_ACCOUNT,
  ],
};

export function buildPermSet(roleCode, extraPerms = []) {
  const base = ROLE_PERMS[roleCode] || [];
  return new Set([...(base || []), ...(extraPerms || [])]);
}
