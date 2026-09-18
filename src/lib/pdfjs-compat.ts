type Uint8ArrayWithModernMethods = Uint8Array & {
  toHex?: () => string
  toBase64?: () => string
}

type Uint8ArrayConstructorWithModernMethods = typeof Uint8Array & {
  fromBase64?: (value: string) => Uint8Array
}

type MapWithModernMethods = Map<unknown, unknown> & {
  getOrInsert?: (key: unknown, value: unknown) => unknown
  getOrInsertComputed?: (key: unknown, callback: () => unknown) => unknown
}

const bytePrototype = Uint8Array.prototype as Uint8ArrayWithModernMethods
const byteConstructor = Uint8Array as Uint8ArrayConstructorWithModernMethods
const mapPrototype = Map.prototype as MapWithModernMethods

if (!bytePrototype.toHex) {
  Object.defineProperty(bytePrototype, 'toHex', {
    configurable: true,
    value() {
      let result = ''
      for (const byte of this) result += byte.toString(16).padStart(2, '0')
      return result
    },
  })
}

if (!bytePrototype.toBase64 && typeof btoa === 'function') {
  Object.defineProperty(bytePrototype, 'toBase64', {
    configurable: true,
    value() {
      let binary = ''
      for (const byte of this) binary += String.fromCharCode(byte)
      return btoa(binary)
    },
  })
}

if (!byteConstructor.fromBase64 && typeof atob === 'function') {
  Object.defineProperty(byteConstructor, 'fromBase64', {
    configurable: true,
    value(value: string) {
      const binary = atob(value)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      return bytes
    },
  })
}

if (!mapPrototype.getOrInsertComputed) {
  Object.defineProperty(mapPrototype, 'getOrInsertComputed', {
    configurable: true,
    value(this: Map<unknown, unknown>, key: unknown, callback: () => unknown) {
      if (!this.has(key)) this.set(key, callback())
      return this.get(key)
    },
  })
}

if (!mapPrototype.getOrInsert) {
  Object.defineProperty(mapPrototype, 'getOrInsert', {
    configurable: true,
    value(this: Map<unknown, unknown>, key: unknown, value: unknown) {
      if (!this.has(key)) this.set(key, value)
      return this.get(key)
    },
  })
}
