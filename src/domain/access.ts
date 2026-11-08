export const roles = ['Director', 'Treasurer', 'HOD', 'Member'] as const;
export type Role = (typeof roles)[number];

export interface SessionProfile {
  uid: string;
  name: string;
  active: true;
  roles: Role[];
  revision: number;
  clubName: string;
  departmentScopes: { activityId: string; departmentId: string; role: 'HOD' | 'Member' }[];
  activityIds: string[];
}
