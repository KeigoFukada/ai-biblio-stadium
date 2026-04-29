// BGM ミュート状態を localStorage に永続化 + リスナー通知
const KEY = "bgm_muted";
type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

export const isBGMMuted = (): boolean => localStorage.getItem(KEY) === "true";

export const setBGMMuted = (v: boolean): void => {
  localStorage.setItem(KEY, String(v));
  listeners.forEach((fn) => fn(v));
};

/** ミュート状態が変化したときに呼ばれるリスナーを登録。戻り値で解除。 */
export const onMuteChange = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
