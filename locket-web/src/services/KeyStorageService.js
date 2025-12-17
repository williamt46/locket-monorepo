const KEY_STORAGE_NAME = 'locket_mk'; // Master Key

export const saveKey = (jwk) => {
  localStorage.setItem(KEY_STORAGE_NAME, JSON.stringify(jwk));
};

export const loadKey = () => {
  const stored = localStorage.getItem(KEY_STORAGE_NAME);
  return stored ? JSON.parse(stored) : null;
};

export const deleteKey = () => {
  localStorage.removeItem(KEY_STORAGE_NAME);
};

export const hasKey = () => {
  return !!localStorage.getItem(KEY_STORAGE_NAME);
};
