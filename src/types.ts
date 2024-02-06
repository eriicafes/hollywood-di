export type Pretty<T> = { [K in keyof T]: T[K] } & {}
export type PrettyStringKeys<T> = { [K in keyof T & string]: T[K] } & {}
export type RecordType<T> = IsAny<T> extends true ? Record<string, any> : T
export type Merge<T, To> = Pretty<RecordType<T> & Omit<RecordType<To>, keyof T>>
export type IsAny<T> = unknown extends T & string ? true : false;
export type KnownKey<T> = string extends T
    ? never
    : number extends T
    ? never
    : symbol extends T
    ? never
    : T
export type KnownMappedKeys<T> = { [K in keyof T as KnownKey<K>]: T[K] } & {}
