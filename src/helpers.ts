import { Token, TokenConstructor, TokenFactory } from "./hollywood"

export function singleton<T, U>(constructor: TokenConstructor<T, U>["useClass"]): TokenConstructor<T, U> {
    return { scope: "singleton", useClass: constructor }
}

export function singletonFactory<T, U>(factoryFn: TokenFactory<T, U>["useFactory"]): TokenFactory<T, U> {
    return { scope: "singleton", useFactory: factoryFn }
}

export function scoped<T, U>(constructor: TokenConstructor<T, U>["useClass"]): TokenConstructor<T, U> {
    return { scope: "scoped", useClass: constructor }
}

export function scopedFactory<T, U>(factoryFn: TokenFactory<T, U>["useFactory"]): TokenFactory<T, U> {
    return { scope: "scoped", useFactory: factoryFn }
}

export const factory = scopedFactory

export function transient<T, U>(constructor: TokenConstructor<T, U>["useClass"]): TokenConstructor<T, U> {
    return { scope: "transient", useClass: constructor }
}

export function transientFactory<T, U>(factoryFn: TokenFactory<T, U>["useFactory"]): TokenFactory<T, U> {
    return { scope: "transient", useFactory: factoryFn }
}

export function alias<T, K extends keyof T>(token: K): Token<T, T[K]> {
    return { scope: "transient", useFactory: (container) => container[token] }
}
