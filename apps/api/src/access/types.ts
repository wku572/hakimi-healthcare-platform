export const workforceRoles = [
  'PLATFORM_ADMIN',
  'FACILITY_ADMIN',
  'SCHEDULER',
  'PRACTITIONER',
  'OPERATIONS_OPERATOR',
] as const;

export type WorkforceRole = (typeof workforceRoles)[number];

export type WorkforceRoleAssignment = Readonly<{
  role: WorkforceRole;
  facilityId: string | null;
}>;

export type VerifiedOidcIdentity = Readonly<{
  issuer: string;
  subject: string;
  sessionHash: string;
  authenticatedAt: Date;
}>;

export type AuthorizationCandidate = Readonly<{
  actorId: string;
  practitionerId: string | null;
  sessionHash: string;
  authenticatedAt: Date;
  authorizationTime: Date;
  roles: readonly WorkforceRoleAssignment[];
  facilityScopes: readonly string[];
}>;

export type AuthorizationContext = Readonly<{
  actorId: string;
  practitionerId: string | null;
  sessionId: string;
  roles: readonly WorkforceRoleAssignment[];
  facilityScopes: readonly string[];
}>;

export type AuthorizationTarget = Readonly<{
  facilityId?: string | undefined;
  practitionerId?: string | undefined;
  patientId?: string | undefined;
  assignmentId?: string | undefined;
  appointmentId?: string | undefined;
}>;

export type DomainAuthorizationScope = Readonly<{
  actorId: string;
  isPlatformAdmin: boolean;
  isPractitioner: boolean;
  facilityIds: readonly string[];
  practitionerId: string | null;
}>;

export type RevocationReason =
  | 'ACTOR_DEACTIVATED'
  | 'ROLE_CHANGED'
  | 'FACILITY_SCOPE_CHANGED'
  | 'PRACTITIONER_STATE_CHANGED'
  | 'PRACTITIONER_ASSIGNMENT_CHANGED'
  | 'PRACTITIONER_BINDING_CHANGED'
  | 'MANUAL_REVOCATION';
