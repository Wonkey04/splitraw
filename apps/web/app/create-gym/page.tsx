"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button, Card, Input } from "@/components/ui";

// Paso 2 de 2 del alta self-serve: crear la organización.
//
// Antes esta pantalla hacía CUATRO escrituras secuenciales desde el browser
// (signUp, organizations, branches, user_profiles) más la generación del
// código. Si fallaba la tercera o la cuarta quedaban un usuario de auth y una
// organización huérfanos: sin sucursal, sin perfil, y el segundo intento con
// el mismo email fallaba en signUp. El dueño quedaba trabado sin salida.
//
// Ahora es una sola llamada a create_gym_with_owner(), que es una función
// plpgsql y por lo tanto UNA transacción: o quedan la organización, la
// sucursal, el perfil y el código, o no queda nada.
export default function CreateGymPage() {
  const router = useRouter();
  const { session, user, loading } = useAuth();
  const [gymName, setGymName] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [branchName, setBranchName] = useState("Sucursal Principal");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // El nombre viene del metadata que dejó /signup. Se deja editable por si el
  // dueño quiere corregirlo antes de que nazca su perfil.
  useEffect(() => {
    const metaName = (user?.user_metadata as { name?: string } | undefined)?.name;
    if (metaName) setOwnerName((prev) => prev || metaName);
  }, [user]);

  // Guard: quien YA tiene organización no vuelve a ver esta pantalla nunca.
  // user_profiles.organization_id es NOT NULL, así que la sola existencia de
  // la fila alcanza como prueba de que el usuario ya está dentro de un gym.
  // El chequeo también está en la RPC (ALREADY_HAS_ORG): acá es para no
  // mostrar un formulario que va a rebotar.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/signup");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("organization_id")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.organization_id) router.replace("/dashboard");
      else setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session, router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!gymName.trim() || !branchName.trim()) {
        setError("El nombre del gimnasio y el de la sucursal son obligatorios.");
        return;
      }

      setSubmitting(true);
      const { error: rpcError } = await supabase.rpc("create_gym_with_owner", {
        p_gym_name: gymName.trim(),
        p_city: city.trim(),
        p_province: province.trim(),
        p_branch_name: branchName.trim(),
        p_owner_name: ownerName.trim(),
      });

      if (rpcError) {
        setSubmitting(false);
        // ALREADY_HAS_ORG llega si el usuario abrió dos pestañas y creó el
        // gimnasio en la otra. No es un error que tenga que leer: ya está.
        if (rpcError.message.includes("ALREADY_HAS_ORG")) {
          router.replace("/dashboard");
          return;
        }
        setError(
          rpcError.message.includes("NOT_AUTHENTICATED")
            ? "Se cerró tu sesión. Iniciá sesión de nuevo."
            : `No se pudo crear el gimnasio: ${rpcError.message}`
        );
        return;
      }

      // El dashboard arranca vacío y con el código a la vista. Sin seeds ni
      // datos de ejemplo: un gimnasio nuevo no tiene alumnos.
      router.push("/dashboard");
    },
    [gymName, city, province, branchName, ownerName, router]
  );

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-textSecondary">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgSecondary p-8">
      <Card className="w-full max-w-[400px]">
        <h1 className="mb-2 text-h2">Creá tu gimnasio</h1>
        <p className="mb-6 text-body text-textSecondary">
          Paso 2 de 2. Podés sumar más sucursales después.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nombre del gimnasio"
            type="text"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            placeholder="Gym Fénix"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ciudad"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Río Tercero"
            />
            <Input
              label="Provincia"
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="Córdoba"
            />
          </div>

          <Input
            label="Sucursal principal"
            type="text"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="Sucursal Principal"
          />

          <Input
            label="Tu nombre"
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Juan Pérez"
          />

          {error && <p className="text-small text-error">{error}</p>}

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "Creando gimnasio..." : "Crear gimnasio"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
