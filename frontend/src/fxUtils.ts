export const FX_KEYS = {
  fx: "ntd_fx",
  matrix: "ntd_matrix",
  cursorfx: "ntd_cursorfx",
  sound: "ntd_sound",
} as const;

export function isAllFxOff(fx: boolean, matrix: boolean, cursor: boolean, sound: boolean): boolean {
  return !fx && !matrix && !cursor && !sound;
}

export function setAllFx(on: boolean): void {
  const val = on ? "on" : "off";
  localStorage.setItem(FX_KEYS.fx, val);
  localStorage.setItem(FX_KEYS.matrix, val);
  localStorage.setItem(FX_KEYS.cursorfx, val);
  localStorage.setItem(FX_KEYS.sound, val);
}

export function readFxState(): { fx: boolean; matrix: boolean; cursor: boolean; sound: boolean } {
  return {
    fx: localStorage.getItem(FX_KEYS.fx) !== "off",
    matrix: localStorage.getItem(FX_KEYS.matrix) !== "off",
    cursor: localStorage.getItem(FX_KEYS.cursorfx) !== "off",
    sound: localStorage.getItem(FX_KEYS.sound) !== "off",
  };
}
