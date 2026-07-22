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
  full_name?: string | null;
}

export interface Routine {
  id: string;
  member_id: string;
  routine_template_id: string;
  organization_id: string;
  assigned_by: string;
  created_at?: string;
}
