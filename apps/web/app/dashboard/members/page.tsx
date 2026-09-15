"use client";

import MembersSection from "@/components/MembersSection";

// Miembros del gimnasio para el GYM_OWNER.
//
// El código de vinculación se fue de acá al home del dashboard: es lo primero
// que necesita un gimnasio recién creado y estaba enterrado abajo del
// listado. Esta pantalla quedó siendo lo que su nombre dice.
//
// El listado es el mismo componente que usa el trainer, con scope "org": el
// owner ve TODA la organización (sin filtro de sucursal) y por eso la tabla
// le agrega la columna Sucursal. El paginado, el buscador y el JOIN a
// user_profiles para el nombre viven en la RPC list_org_members (0010/0017).
export default function MembersListPage() {
  return (
    <div>
      <h1 className="mb-6 text-h1">Miembros</h1>
      <MembersSection
        scope="org"
        assignHrefBase="/dashboard/members"
        scopeLabel="Todas las sucursales"
      />
    </div>
  );
}
