"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../components/ui";

/**
 * Página temporal de validación del sistema visual (paso 2 del refactor).
 * Se elimina una vez validados los componentes base.
 */
export default function StyleguidePage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">Sistema visual</h1>
        <p className="text-body text-textSecondary">Componentes base — light premium, sin profundidad simulada.</p>
      </header>

      <Card className="flex flex-col gap-4">
        <h2 className="text-h2">Botones</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Guardar cambios</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="destructive">Eliminar rutina</Button>
          <Button variant="primary" disabled>
            Deshabilitado
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-h2">Formulario</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombre del gimnasio" placeholder="Ingresá el nombre" />
          <Input label="Email" placeholder="socio@gimnasio.com" error="Ingresá un email válido" />
          <Input label="Código de invitación" defaultValue="ABC123" disabled />
          <Select
            label="Día de la semana"
            placeholder="Elegí un día"
            defaultValue=""
            options={[
              { value: "lunes", label: "Lunes" },
              { value: "martes", label: "Martes" },
              { value: "miercoles", label: "Miércoles" },
            ]}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-h2">Badges</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Activo</Badge>
          <Badge variant="error">Vencido</Badge>
          <Badge variant="warning">Por vencer</Badge>
          <Badge variant="neutral">Sin rutina</Badge>
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2">Tabla</h2>
        <Table>
          <TableHead>
            <TableRow hoverable={false}>
              <TableHeaderCell>Socio</TableHeaderCell>
              <TableHeaderCell>Rutina</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Ana Gómez</TableCell>
              <TableCell>Full body 3 días</TableCell>
              <TableCell>
                <Badge variant="success">Activo</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Bruno Díaz</TableCell>
              <TableCell>Push pull legs</TableCell>
              <TableCell>
                <Badge variant="warning">Por vencer</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <Card className="flex flex-col items-start gap-4">
        <h2 className="text-h2">Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Eliminar rutina"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => setModalOpen(false)}>
                Eliminar
              </Button>
            </>
          }
        >
          Esta acción no se puede deshacer. La rutina se quita de todos los socios asignados.
        </Modal>
      </Card>
    </main>
  );
}
