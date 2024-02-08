export type Pretty<T> = { [K in keyof T]: T[K] } & {}
type IsAny<T> = unknown extends T & string ? true : false;
type RecordType<T> = IsAny<T> extends true ? Record<string, any> : T
type OmitKnownKey<T, U extends PropertyKey> = { [K in keyof T as Exclude<K, U>]: T[K] }
export type Merge<T, To> = Pretty<RecordType<T> & OmitKnownKey<RecordType<To>, keyof T>>
type KnownKey<T> = string extends T
    ? never
    : number extends T
    ? never
    : symbol extends T
    ? never
    : T
export type KnownMappedKeys<T> = { [K in keyof T as KnownKey<K>]: T[K] } & {}
export type HasIndexSignature<T> = KnownKey<keyof T> extends never ? true : false
