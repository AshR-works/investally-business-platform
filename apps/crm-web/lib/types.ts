export interface Profile {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: { code: string; scope: 'OWN' | 'TEAM' | 'ALL' }[];
  mfaEnrolled: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface UserView {
  id: string;
  email: string;
  displayName: string;
  status: 'PENDING' | 'ACTIVE' | 'LOCKED' | 'DISABLED';
  roles: string[];
  managerId: string | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleView {
  code: string;
  label: string;
  description: string;
  mfaRequired: boolean;
  permissions: { code: string; scope: string }[];
}

export interface SessionView {
  id: string;
  ipAddress: string;
  device: string;
  riskLevel: string;
  mfaVerified: boolean;
  loggedInAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface Company {
  id: string;
  name: string;
  status: string;
  sector: string | null;
}
