import { StarIcon } from "@/components/icons";

// Solo se monta cuando el gimnasio está en plan free (chequeado por el
// caller, no acá): un dueño en Pro no debe ver esta card en el DOM.
export default function ProUpsellCard() {
  return (
    <div className="rounded border border-[#DCE6FB] bg-[#EFF4FF] p-4">
      <span className="mb-3 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white text-accent">
        <StarIcon className="h-5 w-5" />
      </span>
      <h3 className="text-[15px] font-bold text-textPrimary">Pasate a Pro</h3>
      <p className="mt-1 text-[12.5px] text-textSecondary">
        Elegí tu propio código de gimnasio y desbloqueá más alumnos y sucursales.
      </p>
    </div>
  );
}
