"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button, Card, Input, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

interface Provincia {
  id: string;
  nombre: string;
}

interface Ciudad {
  id: string;
  provincia_id: string;
  nombre: string;
}

// Únicas provincias/ciudades habilitadas hoy (ver migración 0021). El resto
// se muestra en el selector para que el dueño vea que existen, pero
// deshabilitado: no hay fila real en el catálogo, así que no hay nada que
// elegir todavía.
const ENABLED_PROVINCIA = "Córdoba";
const ENABLED_CIUDAD = "Río Tercero";

// Provincias argentinas para mostrar "todo deshabilitado salvo Córdoba" en
// vez de un selector con una sola opción: comunica que el resto existe y
// llega después, no que el país termina en Córdoba. No son filas de la
// base — por eso no tienen id y no se pueden enviar al servidor.
const OTHER_PROVINCIAS = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

// Paso 2 de 2 del alta self-serve: crear la organización.
//
// Antes esta pantalla hacía CUATRO escrituras secuenciales desde el browser
// (signUp, organizations, branches, user_profiles). Ahora es una sola
// llamada a create_gym_with_owner(), que es una función plpgsql y por lo
// tanto UNA transacción.
//
// El campo "Tu nombre" que había acá se sacó: ya se pidió en /signup y
// queda en el metadata del usuario de auth (ver ese archivo). Pedirlo de
// nuevo acá era el mismo dato dos veces en el mismo alta — se manda tal
// cual llegó, sin una segunda oportunidad de "corregirlo" que en la
// práctica nadie usaba y que duplicaba el campo en el wizard.
export default function CreateGymPage() {
  const router = useRouter();
  const { session, user, loading } = useAuth();
  const [gymName, setGymName] = useState("");
  const [provinciaId, setProvinciaId] = useState("");
  const [ciudadId, setCiudadId] = useState("");
  const [branchName, setBranchName] = useState("Sucursal Principal");
  const [branchAddress, setBranchAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [goingBack, setGoingBack] = useState(false);

  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);

  const ownerName = (user?.user_metadata as { name?: string } | undefined)?.name?.trim() ?? "";

  useEffect(() => {
    supabase
      .from("provincias")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setProvincias((data as Provincia[]) ?? []));
    supabase
      .from("ciudades")
      .select("id, provincia_id, nombre")
      .order("nombre")
      .then(({ data }) => setCiudades((data as Ciudad[]) ?? []));
  }, []);

  // Guard: quien YA tiene organización no vuelve a ver esta pantalla nunca.
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

  // "Atrás" no puede volver a /signup de verdad: la cuenta de auth ya
  // existe, y /signup redirige para adelante apenas detecta sesión (ver ese
  // archivo). La única vuelta atrás honesta es cerrar esta sesión y
  // arrancar de cero — típicamente para corregir el email con el que se
  // registró.
  async function handleBack() {
    setGoingBack(true);
    await supabase.auth.signOut();
    router.replace("/signup");
  }

  const provinciaOptions: SelectOption[] = [
    ...provincias.map((p) => ({ value: p.id, label: p.nombre })),
    ...OTHER_PROVINCIAS.filter((nombre) => !provincias.some((p) => p.nombre === nombre)).map((nombre) => ({
      value: `disabled:${nombre}`,
      label: `${nombre} (Próximamente)`,
      disabled: true,
    })),
  ];

  const selectedProvinciaNombre = provincias.find((p) => p.id === provinciaId)?.nombre ?? null;
  const ciudadesDeProvincia = ciudades.filter((c) => c.provincia_id === provinciaId);

  const ciudadOptions: SelectOption[] =
    selectedProvinciaNombre === ENABLED_PROVINCIA
      ? ciudadesDeProvincia.map((c) => ({ value: c.id, label: c.nombre }))
      : [{ value: "disabled:otras", label: "Elegí primero una provincia habilitada", disabled: true }];

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!gymName.trim() || !branchName.trim()) {
        setError("El nombre del gimnasio y el de la sucursal son obligatorios.");
        return;
      }
      if (!ciudadId) {
        setError("Elegí una ciudad. Por ahora solo Río Tercero, Córdoba está habilitada.");
        return;
      }

      setSubmitting(true);
      const { error: rpcError } = await supabase.rpc("create_gym_with_owner", {
        p_gym_name: gymName.trim(),
        p_city: null,
        p_province: null,
        p_branch_name: branchName.trim(),
        p_owner_name: ownerName,
        p_ciudad_id: ciudadId,
        p_branch_address: branchAddress.trim() || null,
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
    [gymName, branchName, branchAddress, ciudadId, ownerName, router]
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
      <Card className="w-full max-w-[420px]">
        <button
          type="button"
          onClick={handleBack}
          disabled={goingBack}
          className="mb-4 text-body text-accent hover:text-accentHover disabled:text-textSecondary"
        >
          ← Atrás
        </button>

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
            <Select
              label="Provincia"
              placeholder="Elegí una provincia"
              options={provinciaOptions}
              value={provinciaId}
              onChange={(e) => {
                setProvinciaId(e.target.value);
                setCiudadId("");
              }}
            />
            <Select
              label="Ciudad"
              placeholder="Elegí una ciudad"
              options={ciudadOptions}
              value={ciudadId}
              disabled={selectedProvinciaNombre !== ENABLED_PROVINCIA}
              onChange={(e) => setCiudadId(e.target.value)}
            />
          </div>

          {selectedProvinciaNombre && selectedProvinciaNombre !== ENABLED_PROVINCIA && (
            <p className="text-small text-textSecondary">
              Por ahora solo abrimos en {ENABLED_CIUDAD}, {ENABLED_PROVINCIA}. El resto está en camino.
            </p>
          )}

          <Input
            label="Sucursal principal"
            type="text"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="Sucursal Principal"
          />

          <Input
            label="Dirección de la sucursal"
            type="text"
            value={branchAddress}
            onChange={(e) => setBranchAddress(e.target.value)}
            placeholder="Av. San Martín 450"
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
