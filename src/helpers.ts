import { TokenConstructor, TokenFactory } from "./container"

export function singleton<T, U>(constructor: TokenConstructor<T, U>["init"]): TokenConstructor<T, U> {
    return { scope: "singleton", type: "constructor", init: constructor }
}

export function singletonFactory<T, U>(factoryFn: TokenFactory<T, U>["init"]): TokenFactory<T, U> {
    return { scope: "singleton", type: "factory", init: factoryFn }
}

export function scoped<T, U>(constructor: TokenConstructor<T, U>["init"]): TokenConstructor<T, U> {
    return { scope: "scoped", type: "constructor", init: constructor }
}

export function scopedFactory<T, U>(factoryFn: TokenFactory<T, U>["init"]): TokenFactory<T, U> {
    return { scope: "scoped", type: "factory", init: factoryFn }
}

export const factory = scopedFactory

export function transient<T, U>(constructor: TokenConstructor<T, U>["init"]): TokenConstructor<T, U> {
    return { scope: "transient", type: "constructor", init: constructor }
}

export function transientFactory<T, U>(factoryFn: TokenFactory<T, U>["init"]): TokenFactory<T, U> {
    return { scope: "transient", type: "factory", init: factoryFn }
}

type Alias<T> = { to<K extends keyof T>(token: K): TokenFactory<T, T[K]> }

export function alias<T>(): Alias<T>
export function alias<T, K extends keyof T>(token: K): TokenFactory<T, T[K]>
export function alias<T, K extends keyof T>(token?: K): Alias<T> | TokenFactory<T, T[K]> {
    if (token !== undefined) {
        return { scope: "transient", type: "factory", init: (container) => container[token] }
    } else {
        return {
            to(token) {
                return { scope: "transient", type: "factory", init: (container) => container[token] }
            },
        }
    }
}
