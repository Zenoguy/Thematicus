import { openDB } from 'idb';

const DB_NAME = 'ThematicusDB';
const DB_VERSION = 1;

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache'); // key-val store
      }
    },
  });
}

export async function saveToCache(key, data) {
  const db = await initDB();
  await db.put('cache', data, key);
}

export async function loadFromCache(key) {
  const db = await initDB();
  return await db.get('cache', key);
}

export async function clearCache() {
  const db = await initDB();
  await db.clear('cache');
}
