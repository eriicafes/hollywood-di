export type Merge<T, To> = Omit<To, keyof T> & T
export type IsAny<T> = unknown extends T & string ? true : false;
export type KnownKey<T> = string extends T
    ? never
    : number extends T
    ? never
    : symbol extends T
    ? never
    : T
export type KnownMappedKeys<T> = { [K in keyof T as KnownKey<K>]: T[K] } & {}
