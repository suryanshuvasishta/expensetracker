import { createContext, useContext } from 'react';

interface MobileMenuCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const MobileMenuContext = createContext<MobileMenuCtx>({ open: false, setOpen: () => {} });
export const useMobileMenu = () => useContext(MobileMenuContext);
