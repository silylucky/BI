export type MeProfile = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: string[];
  permissions?: string[];
  isRoot?: boolean;
};
