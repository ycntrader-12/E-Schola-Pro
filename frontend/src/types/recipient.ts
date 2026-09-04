export interface UserMinimalRead {
  id: number | string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

export interface ComposerFormValues {
  to: UserMinimalRead[];
  cc: UserMinimalRead[];
  subject: string;
  body: string;
}
