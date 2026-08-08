import { Modal } from '../../shared/ui/Modal';

interface Props {
  nombreMesera: string;
  onContinuar: () => void;
  onCancelar: () => void;
}

/**
 * Aviso al entrar a una cuenta de otra mesera.
 *
 * Es un AVISO, no un obstáculo. El caso real: Don Carlos le pide a Ana que le
 * cambie el pedido, aunque la cuenta la abrió María. Ana tiene que poder
 * hacerlo. Lo que el sistema hace es dejar constancia — el cambio queda a
 * nombre de Ana en la bitácora — y aclarar que la cuenta sigue siendo de María
 * para efectos del reporte y del reparto.
 */
export function AvisoCuentaAjena({ nombreMesera, onContinuar, onCancelar }: Props) {
  return (
    <Modal
      abierto
      titulo={`Esta cuenta es de ${nombreMesera}`}
      onCerrar={onCancelar}
      pie={
        <>
          <button type="button" className="boton-secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="boton-primario" onClick={onContinuar} autoFocus>
            Continuar
          </button>
        </>
      }
    >
      <p className="text-base">
        Podés tomarle el pedido sin problema. Los cambios quedan registrados a tu nombre, y la
        cuenta sigue siendo de <strong>{nombreMesera}</strong>.
      </p>
    </Modal>
  );
}
