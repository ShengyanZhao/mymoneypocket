/* The one import every page needs: `useT` in a component, `t` in a plain
   module, `setLocale` from the toggle. */

export {
  getFormatLocale,
  getLocale,
  joinList,
  setLocale,
  subscribe,
  t,
  tIn,
  tOpt,
  tPlain,
  tRich,
  catalogues,
  type Locale,
  type MessageKey,
  type Params,
  type RichPart,
} from "./t.ts";

export { useT, type T } from "./useT.ts";
