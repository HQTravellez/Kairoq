import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { functions } from 'kairoq';
import { toast } from 'sonner';

// The signed-in company's workspace: travelers, trips, approvals, expenses and policy.
// Every change goes through the travel server function, which returns the fresh workspace.
const Ctx = createContext(null);
export function WorkspaceProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await functions.invoke('travel', { action: 'load' })); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = useCallback(async (action, body = {}, success) => {
    try {
      const r = await functions.invoke('travel', { action, ...body });
      if (r.workspace) setData(r.workspace);
      if (success) toast.success(success);
      return r;
    } catch (err) { toast.error(err.message); return null; }
  }, []);
  return <Ctx.Provider value={{ data, error, reload: load, act }}>{children}</Ctx.Provider>;
}
export function useWorkspace() { return useContext(Ctx); }
