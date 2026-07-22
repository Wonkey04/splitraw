// Mirrors apps/web/lib/types.ts (same Supabase schema, same project).
export interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  branch_id: string;
  email: string;
  full_name?: string | null;
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
