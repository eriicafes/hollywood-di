import { ConstructorToken, FactoryToken } from "./hollywood"

export function singleton<T, U>(constructor: ConstructorToken<T, U>["init"]): ConstructorToken<T, U> {
    return { scope: "singleton", type: "constructor", init: constructor }
}

export function singletonFactory<T, U>(factoryFn: FactoryToken<T, U>["init"]): FactoryToken<T, U> {
    return { scope: "singleton", type: "factory", init: factoryFn }
}

export function scoped<T, U>(constructor: ConstructorToken<T, U>["init"]): ConstructorToken<T, U> {
    return { scope: "scoped", type: "constructor", init: constructor }
}

export function scopedFactory<T, U>(factoryFn: FactoryToken<T, U>["init"]): FactoryToken<T, U> {
    return { scope: "scoped", type: "factory", init: factoryFn }
}

export const factory = scopedFactory

export function transient<T, U>(constructor: ConstructorToken<T, U>["init"]): ConstructorToken<T, U> {
    return { scope: "transient", type: "constructor", init: constructor }
}

export function transientFactory<T, U>(factoryFn: FactoryToken<T, U>["init"]): FactoryToken<T, U> {
    return { scope: "transient", type: "factory", init: factoryFn }
}

export function alias<T, K extends keyof T>(token: K): FactoryToken<T, T[K]> {
    return { scope: "transient", type: "factory", init: (container) => container[token] }
}
