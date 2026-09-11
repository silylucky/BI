import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import {
  isDetachedFromWorkspacePath,
  isWorkspacePath,
  resolveWorkspaceReturnPath,
  WORKSPACE_HOME_PATH,
  WORKSPACE_RETURN_PATH_KEY,
} from "@/lib/workspace";

export type WorkspaceContextType = {
  returnToWorkspace: () => void;
  canReturnToWorkspace: boolean;
  beginAccountManagement: () => void;
  beginSystemAdmin: () => void;
};

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(
  undefined,
);

function readStoredReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(WORKSPACE_RETURN_PATH_KEY);
  return stored && isWorkspacePath(stored) ? stored : null;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const previousPathRef = React.useRef(location.pathname);
  const [returnPath, setReturnPath] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (isWorkspacePath(window.location.pathname)) return null;
    if (isDetachedFromWorkspacePath(window.location.pathname)) {
      return readStoredReturnPath() ?? WORKSPACE_HOME_PATH;
    }
    return readStoredReturnPath();
  });

  const persistReturnPath = React.useCallback((path: string) => {
    setReturnPath(path);
    localStorage.setItem(WORKSPACE_RETURN_PATH_KEY, path);
  }, []);

  const rememberWorkspaceReturnPath = React.useCallback(() => {
    const current = location.pathname;
    if (isWorkspacePath(current)) {
      persistReturnPath(current);
      return;
    }
    persistReturnPath(returnPath ?? readStoredReturnPath() ?? WORKSPACE_HOME_PATH);
  }, [location.pathname, persistReturnPath, returnPath]);

  const beginAccountManagement = rememberWorkspaceReturnPath;
  const beginSystemAdmin = rememberWorkspaceReturnPath;

  React.useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentPath = location.pathname;

    if (isWorkspacePath(previousPath) && isDetachedFromWorkspacePath(currentPath)) {
      persistReturnPath(previousPath);
    }

    if (isWorkspacePath(currentPath)) {
      setReturnPath(null);
      localStorage.removeItem(WORKSPACE_RETURN_PATH_KEY);
    }

    previousPathRef.current = currentPath;
  }, [location.pathname, persistReturnPath]);

  const returnToWorkspace = React.useCallback(() => {
    const target = resolveWorkspaceReturnPath(returnPath ?? WORKSPACE_HOME_PATH);
    setReturnPath(null);
    localStorage.removeItem(WORKSPACE_RETURN_PATH_KEY);
    navigate(target);
  }, [navigate, returnPath]);

  const canReturnToWorkspace = isDetachedFromWorkspacePath(location.pathname);

  const value = React.useMemo<WorkspaceContextType>(
    () => ({
      returnToWorkspace,
      canReturnToWorkspace,
      beginAccountManagement,
      beginSystemAdmin,
    }),
    [beginAccountManagement, beginSystemAdmin, canReturnToWorkspace, returnToWorkspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
