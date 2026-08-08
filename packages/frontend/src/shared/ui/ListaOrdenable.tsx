import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props<T> {
  elementos: T[];
  idDe: (elemento: T) => number;
  onReordenar: (idsEnOrden: number[]) => void;
  children: (elemento: T, manija: React.ReactNode) => React.ReactNode;
  deshabilitado?: boolean;
}

/**
 * Lista reordenable por arrastre.
 *
 * El arrastre se agarra SOLO de la manija, no de la fila entera: si no, tocar
 * un producto para editarlo terminaría moviéndolo de lugar sin querer.
 *
 * dnd-kit da puntero, táctil y teclado en el mismo componente. Lo del teclado
 * importa: la dueña puede estar en la laptop, y arrastrar con el trackpad en
 * una lista de 20 productos es incómodo. Con la manija enfocada, espacio agarra
 * y las flechas mueven.
 */
export function ListaOrdenable<T>({
  elementos,
  idDe,
  onReordenar,
  children,
  deshabilitado,
}: Props<T>) {
  const sensores = useSensors(
    // 8 px de tolerancia: un toque no cuenta como arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = elementos.map(idDe);

  function alSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const desde = ids.indexOf(Number(active.id));
    const hasta = ids.indexOf(Number(over.id));
    if (desde === -1 || hasta === -1) return;

    onReordenar(arrayMove(ids, desde, hasta));
  }

  if (deshabilitado) {
    return <>{elementos.map((el) => children(el, null))}</>;
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={alSoltar}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {elementos.map((elemento) => (
          <FilaOrdenable key={idDe(elemento)} id={idDe(elemento)}>
            {(manija) => children(elemento, manija)}
          </FilaOrdenable>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function FilaOrdenable({
  id,
  children,
}: {
  id: number;
  children: (manija: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const manija = (
    <button
      type="button"
      aria-label="Mover"
      className="min-h-tactil min-w-tactil cursor-grab touch-none rounded-lg text-slate-400
                 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <span aria-hidden className="text-xl leading-none">
        ⠿
      </span>
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-90 shadow-lg' : undefined}
    >
      {children(manija)}
    </div>
  );
}
