export interface Organization {
  id: string;
  name: string;
  invitation_code_id?: string | null;
  created_at?: string;
}

export interface GymInvitationCode {
  id: string;
  organization_id: string;
  code: string;
  created_at?: string;
  deleted_at?: string | null;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  address?: string | null;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  organization_id: string;
  branch_id: string;
  role: string;
  name: string;
  surname?: string | null;
  phone?: number | null;
  /** Foto de perfil: URL publica del bucket `avatars` (0012). */
  avatar_url?: string | null;
  created_at?: string;
}

export interface ExerciseCatalog {
  id: string;
  name: string;
  description?: string | null;
  muscle_group_id: number;
  created_at?: string;
}

export interface MuscleGroup {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
}

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  branch_id: string;
  created_by: string;
  created_at?: string;
}

export interface Exercise {
  id: string;
  routine_template_id: string;
  name: string;
  day_of_week: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number;
  created_at?: string;
}

export interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  branch_id: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  activated_at?: string | null;
  activation_expires_at?: string | null;
  /**
   * OJO: la tabla `members` NO tiene esta columna en la base real (se
   * verificó contra el esquema vivo). El nombre del socio vive en
   * user_profiles, ligado por members.user_id = user_profiles.id. Queda
   * declarada como opcional porque las pantallas del owner todavía la leen
   * y caen al email; el listado del trainer sí hace el join correcto.
   */
  full_name?: string | null;
}

export interface TrainerInvitation {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  branch_id: string;
  invited_by: string;
  token: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
}

export interface Routine {
  id: string;
  member_id: string;
  routine_template_id: string;
  organization_id: string;
  assigned_by: string;
  created_at?: string;
}
