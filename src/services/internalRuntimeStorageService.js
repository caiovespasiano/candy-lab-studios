const globalRuntimeStorageMap = new Map()

const internalRuntimeStorage = {
  getItem(storageKey) {
    return globalRuntimeStorageMap.has(storageKey) ? globalRuntimeStorageMap.get(storageKey) : null
  },

  setItem(storageKey, storageValue) {
    globalRuntimeStorageMap.set(storageKey, String(storageValue))
  },

  removeItem(storageKey) {
    globalRuntimeStorageMap.delete(storageKey)
  },
}

export { internalRuntimeStorage }
