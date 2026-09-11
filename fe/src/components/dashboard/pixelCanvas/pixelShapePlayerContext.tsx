import { createContext, useContext, type ReactNode } from "react";

const PixelShapePlayerContext = createContext(false);

/** 对标 DataEase isPlayer：仅当前 shape 内子树感知交互，避免全画布 context 重渲染 */
export function PixelShapePlayerProvider({
  playing,
  children,
}: {
  playing: boolean;
  children: ReactNode;
}) {
  return (
    <PixelShapePlayerContext.Provider value={playing}>
      {children}
    </PixelShapePlayerContext.Provider>
  );
}

export function usePixelShapePlayer(): boolean {
  return useContext(PixelShapePlayerContext);
}
