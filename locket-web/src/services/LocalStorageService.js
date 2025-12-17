const STORAGE_KEY = 'locket_events';

export const saveEvent = (encryptedData, assetId) => {
  const events = getEvents();
  const newEvent = {
    ...encryptedData,
    assetId,
    timestamp: Date.now(),
  };
  events.push(newEvent);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  return newEvent;
};

export const getEvents = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const clearData = () => {
  localStorage.removeItem(STORAGE_KEY);
};
