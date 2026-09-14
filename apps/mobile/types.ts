// Mirrors apps/web/lib/types.ts (same Supabase schema, same project).
export interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  branch_id: string;
  email: string;
  full_name?: string | null;
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

export interface Routine {
  id: string;
  member_id: string;
  routine_template_id: string;
  organization_id: string;
  assigned_by: string;
  created_at?: string;
}

export interface ExerciseLog {
  id: string;
  member_id: string;
  routine_id: string;
  fecha: string;
  completado: boolean;
  created_at?: string;
}
