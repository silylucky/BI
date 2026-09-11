import { createContext, useContext, type PointerEvent as ReactPointerEvent } from "react";
import type { PixelInteractionKind } from "./geometry";

type PixelShapeInteractionHandler = (
  event: ReactPointerEvent<HTMLElement>,
  kind: PixelInteractionKind,
) => void;

const PixelShapeInteractionContext = createContext<PixelShapeInteractionHandler | null>(null);

export function PixelShapeInteractionProvider({
  value,
  children,
}: {
  value: PixelShapeInteractionHandler;
  children: React.ReactNode;
}) {
  return (
    <PixelShapeInteractionContext.Provider value={value}>
      {children}
    </PixelShapeInteractionContext.Provider>
  );
}

export function usePixelShapeInteraction(): PixelShapeInteractionHandler | null {
  return useContext(PixelShapeInteractionContext);
}
