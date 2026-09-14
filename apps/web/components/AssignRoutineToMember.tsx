"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { RoutineTemplate } from "@/lib/types";
import { Badge, Button, Card } from "@/components/ui";

// Assigns a routine template to a single member by inserting a row into
// `routines`. Redirects back a donde diga `backHref` al terminar.
//
// Compartido entre el GYM_OWNER (/dashboard/members/[id]/assign-routine) y
// el TRAINER (/trainer/members/[id]/assign-routine): el INSERT es el mismo,
// y en el caso del trainer la RLS de 0008 ademas exige que el member sea de
// su sucursal.
export interface AssignRoutineToMemberProps {
  /** A donde volver despues de asignar. */
  backHref: string;
  /** A donde manda el CTA cuando el gimnasio todavia no tiene rutinas. */
  createRoutineHref: string;
}

interface TemplateCard {
  template: RoutineTemplate;
  exerciseCount: number;
  /** Dias con al menos un ejercicio cargado, ordenados. */
  days: number[];
}

export default function AssignRoutineToMember({
  backHref,
  createRoutineHref,
}: AssignRoutineToMemberProps) {
  const params = useParams<{ id: string }>();
  const memberId = params?.id as string;
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();

  const [cards, setCards] = useState<TemplateCard[]>([]);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [currentRoutineName, setCurrentRoutineName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profileLoading) return;

    if (!profile) {
      setError("No se encontró tu perfil. Volvé a loguearte.");
      setLoading(false);
      return;
    }

    async function loadScreen() {
      try {
        const [templatesRes, memberRes] = await Promise.all([
          supabase
            .from("routine_templates")
            .select("*")
            .eq("organization_id", profile!.organization_id)
            .order("created_at", { ascending: false }),
          supabase.from("members").select("id, user_id, email").eq("id", memberId).maybeSingle(),
        ]);

        // Header: a quien le estoy asignando. El nombre no esta en `members`
        // (esa tabla no tiene columna de nombre), viene de user_profiles.
        if (memberRes.data) {
          const member = memberRes.data as { user_id: string; email: string };
          const { data: memberProfile } = await supabase
            .from("user_profiles")
            .select("name, surname")
            .eq("id", member.user_id)
            .maybeSingle();

          const fullName = memberProfile
            ? `${memberProfile.name ?? ""} ${memberProfile.surname ?? ""}`.trim()
            : "";
          setMemberName(fullName || member.email);
        }

        // Contexto: que rutina tiene hoy. `routines` es historial, la actual
        // es la ultima asignada.
        const { data: currentRoutine } = await supabase
          .from("routines")
          .select("routine_template_id, assigned_at")
          .eq("member_id", memberId)
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (templatesRes.error) {
          setError("No se pudieron cargar las rutinas.");
          return;
        }

        const templates = (templatesRes.data as RoutineTemplate[]) ?? [];

        if (currentRoutine) {
          const current = templates.find(
            (t) => t.id === (currentRoutine as { routine_template_id: string }).routine_template_id
          );
          setCurrentRoutineName(current?.name ?? null);
        }

        // Preview de cada rutina: cuantos ejercicios y en que dias. Sin esto
        // el selector es una lista de nombres sueltos y el trainer tiene que
        // abrir cada una para saber cual es cual.
        let countsByTemplate = new Map<string, { count: number; days: Set<number> }>();
        if (templates.length > 0) {
          const { data: exerciseRows } = await supabase
            .from("exercises")
            .select("routine_template_id, day_of_week")
            .in(
              "routine_template_id",
              templates.map((t) => t.id)
            );

          countsByTemplate = new Map();
          for (const row of (exerciseRows as
            | { routine_template_id: string; day_of_week: number | null }[]
            | null) ?? []) {
            const entry = countsByTemplate.get(row.routine_template_id) ?? {
              count: 0,
              days: new Set<number>(),
            };
            entry.count += 1;
            if (row.day_of_week) entry.days.add(row.day_of_week);
            countsByTemplate.set(row.routine_template_id, entry);
          }
        }

        setCards(
          templates.map((template) => {
            const entry = countsByTemplate.get(template.id);
            return {
              template,
              exerciseCount: entry?.count ?? 0,
              days: entry ? Array.from(entry.days).sort((a, b) => a - b) : [],
            };
          })
        );

        if (templates.length > 0) setSelectedId(templates[0].id);
      } catch {
        setError("No se pudieron cargar las rutinas.");
      } finally {
        setLoading(false);
      }
    }
    loadScreen();
  }, [profile, profileLoading, memberId]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedId) {
      setError("Seleccioná una rutina.");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      setError("Tu sesión expiró, volvé a loguearte.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("routines").insert({
      member_id: memberId,
      routine_template_id: selectedId,
      organization_id: profile!.organization_id,
      assigned_by: userId,
    });

    setSubmitting(false);

    if (insertError) {
      setError("No se pudo asignar la rutina.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push(backHref), 1600);
  }

  if (loading) return <p className="text-body text-textSecondary">Cargando...</p>;

  const selectedCard = cards.find((c) => c.template.id === selectedId);

  // Confirmacion explicita: antes esto era un redirect silencioso y no
  // quedaba claro si habia pasado algo.
  if (success) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="flex flex-col gap-2">
          <Badge variant="success">Rutina asignada</Badge>
          <p className="text-body text-textPrimary">
            {selectedCard?.template.name} quedó asignada a {memberName ?? "el miembro"}.
          </p>
          <p className="text-body text-textSecondary">Volviendo al listado...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-h1">Asignar rutina</h1>
        <p className="mt-1 text-body text-textSecondary">
          A <span className="text-textPrimary">{memberName ?? "este miembro"}</span>
        </p>
        {currentRoutineName && (
          <p className="mt-2 text-body text-textSecondary">
            Rutina actual: <span className="text-textPrimary">{currentRoutineName}</span>
          </p>
        )}
      </div>

      {/* Estado vacio con salida, en vez de un form que no se puede usar. */}
      {cards.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <div>
            <h2 className="text-h3">Todavía no hay rutinas</h2>
            <p className="mt-1 text-body text-textSecondary">
              Para asignarle una rutina a {memberName ?? "este miembro"} primero tenés que crear al
              menos una.
            </p>
          </div>
          <Link
            href={createRoutineHref}
            className="rounded bg-accent px-4 py-2 text-body font-medium text-white transition-colors hover:bg-accentHover"
          >
            Crear rutina
          </Link>
        </Card>
      ) : (
        <form onSubmit={handleAssign} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            {cards.map(({ template, exerciseCount, days }) => {
              const selected = template.id === selectedId;

              return (
                <label
                  key={template.id}
                  className={
                    "flex cursor-pointer items-start gap-4 rounded border p-4 transition-colors " +
                    (selected
                      ? "border-accent bg-bgTertiary"
                      : "border-border bg-bgPrimary hover:border-accent")
                  }
                >
                  <input
                    type="radio"
                    name="routine"
                    value={template.id}
                    checked={selected}
                    onChange={() => setSelectedId(template.id)}
                    className="mt-1 accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-textPrimary">{template.name}</p>
                    {template.description && (
                      <p className="mt-1 text-body text-textSecondary">{template.description}</p>
                    )}
                    <p className="mt-2 text-small text-textSecondary">
                      {exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                      {days.length > 0 && (
                        <>
                          {" · "}
                          {days
                            .map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label.slice(0, 3))
                            .filter(Boolean)
                            .join(" · ")}
                        </>
                      )}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {error && <p className="text-small text-error">{error}</p>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Asignando..." : "Asignar rutina"}
            </Button>
            <Link
              href={backHref}
              className="rounded border border-border px-4 py-2 text-body font-medium text-textPrimary transition-colors hover:bg-bgTertiary"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
