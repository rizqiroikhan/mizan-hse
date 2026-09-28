const ready = new Promise((resolve, reject) => {
  const req = indexedDB.open('mizan-hse', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('kv');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
export async function read(key, fallback = null) {
  const db = await ready;
  return new Promise((resolve, reject) => { const req = db.transaction('kv').objectStore('kv').get(key); req.onsuccess = () => resolve(req.result ?? fallback); req.onerror = () => reject(req.error); });
}
export async function write(key, value) {
  const db = await ready;
  return new Promise((resolve, reject) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Local storage write failed.')); });
}
