import { useRef, useState } from "react";
import type { DragEvent } from "react";

/**
 * Перетаскивание строк таблицы мышью (HTML5 drag-and-drop, без библиотек).
 * Строка, брошенная на другую, встаёт на её место: вниз — после неё, вверх — перед.
 * onReorder получает весь список id в новом порядке.
 */
export function useRowDrag(ids: string[], onReorder: (ids: string[]) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // После броска браузер может прислать click по строке — он не должен открывать форму.
  const justDragged = useRef(false);

  const reset = () => {
    setDragId(null);
    setOverId(null);
  };

  const rowProps = (id: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      setDragId(id);
      justDragged.current = true;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    },
    onDragOver: (event: DragEvent) => {
      if (!dragId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (overId !== id) setOverId(id);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (dragId && dragId !== id) {
        const movingDown = ids.indexOf(dragId) < ids.indexOf(id);
        const next = ids.filter((x) => x !== dragId);
        next.splice(next.indexOf(id) + (movingDown ? 1 : 0), 0, dragId);
        onReorder(next);
      }
      reset();
    },
    onDragEnd: () => {
      reset();
      setTimeout(() => {
        justDragged.current = false;
      }, 0);
    },
  });

  /** Куда встанет перетаскиваемая строка относительно строки id — для полоски-подсказки. */
  const dropSide = (id: string): "before" | "after" | null => {
    if (!dragId || overId !== id || dragId === id) return null;
    return ids.indexOf(dragId) < ids.indexOf(id) ? "after" : "before";
  };

  return { rowProps, dragId, dropSide, wasDragged: () => justDragged.current };
}
