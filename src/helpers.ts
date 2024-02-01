import { TokenConstructor, TokenFactory, TokenOptions } from "./container"

/**
 * Creates a constructor token as `singleton`. The same instance will be shared between the container and all children containers.
 * @param constructor class constructor
 * @param options configure token options
 */
export function singleton<T, U>(constructor: TokenConstructor<T, U>["init"], options?: TokenOptions<U>): TokenConstructor<T, U> {
    return { scope: "singleton", type: "constructor", init: constructor, ...options }
}

/**
 * Creates a factory token as `singleton`. The same instance will be shared between the container and all children containers.
 * @param factoryFn factory function
 * @param options configure token options
 */
export function singletonFactory<T, U>(factoryFn: TokenFactory<T, U>["init"], options?: TokenOptions<U>): TokenFactory<T, U> {
    return { scope: "singleton", type: "factory", init: factoryFn, ...options }
}

/**
 * Creates a constructor token as `scoped`. A unique instance will always be created for each container.
 * @param constructor class constructor
 * @param options configure token options
 */
export function scoped<T, U>(constructor: TokenConstructor<T, U>["init"], options?: TokenOptions<U>): TokenConstructor<T, U> {
    return { scope: "scoped", type: "constructor", init: constructor, ...options }
}

/**
 * Creates a factory token as `scoped`. A unique instance will always be created for each container.
 * @param factoryFn factory function
 * @param options configure token options
 */
export function scopedFactory<T, U>(factoryFn: TokenFactory<T, U>["init"], options?: TokenOptions<U>): TokenFactory<T, U> {
    return { scope: "scoped", type: "factory", init: factoryFn, ...options }
}

export const factory = scopedFactory

/**
 * Creates a constructor token as `transient`. A new instance will always be created everytime it is accessed from the container.
 * @param constructor class constructor
 * @param options configure token options
 */
export function transient<T, U>(constructor: TokenConstructor<T, U>["init"], options?: Omit<TokenOptions<U>, "lazy">): TokenConstructor<T, U> {
    return { scope: "transient", type: "constructor", init: constructor, ...options }
}

/**
 * Creates a factory token as `transient`. A new instance will always be created everytime it is accessed from the container.
 * @param factoryFn factory function
 * @param options configure token options
 */
export function transientFactory<T, U>(factoryFn: TokenFactory<T, U>["init"], options?: Omit<TokenOptions<U>, "lazy">): TokenFactory<T, U> {
    return { scope: "transient", type: "factory", init: factoryFn, ...options }
}

type Alias<T> = {
    /**
     * Token to alias.
     * @param token token name
     */
    to<K extends keyof T>(token: K): TokenFactory<T, T[K]>
}

/**
 * Aliases a token in an `inferred` container.
 * An inferred container does not have a finalized shape yet therefore a generic type argument is required.
 * 
 * An alias is simply a factory that returns another token.
 * 
 * @example
 * const container1 = Hollywood.create({
 *     counter: Counter,
 *     counterAlias: alias<{ counter: Counter }>().to("counter"),
 * })
 */
export function alias<T>(): Alias<T>
/**
 * Aliases a token in a `typed` container.
 * 
 * An alias is simply a factory that returns another token.
 * 
 * @example
 * const container1 = Hollywood.create<{ counter: Counter, counterAlias: Counter }>({
 *     counter: Counter,
 *     counterAlias: alias("counter"),
 * })
 *
 * @param token token name
 */
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
