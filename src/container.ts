import { ResolutionError } from "./errors"
import { scoped } from "./helpers"
import { IsAny, KnownKey, KnownMappedKeys, Merge } from "./types/utils"

// initializers
export type InitFactory<TContainer, T> = { init: (container: TContainer) => T }
export type EmptyConstructor<T> = new () => T
export type InitConstructor<TContainer, T> = (new (...args: any[]) => T) & InitFactory<TContainer, T>
export type InstantiableConstructor<TContainer, T> = InitConstructor<TContainer, T> | EmptyConstructor<T>

// tokens
export type Scope = "singleton" | "scoped" | "transient"
export type TokenConstructor<TContainer, T> = { scope: Scope, type: "constructor", init: InstantiableConstructor<TContainer, T> }
export type TokenFactory<TContainer, T> = { scope: Scope, type: "factory", init: (container: TContainer) => T }
export type Token<TContainer, T> = TokenConstructor<TContainer, T> | TokenFactory<TContainer, T>
export type RegisterToken<TContainer, T> = Token<TContainer, T> | InstantiableConstructor<TContainer, T>
export type RegisterTokens<T extends Record<string, any>, P extends Record<string, any>> = {
    [K in keyof T]: RegisterToken<{
        [Key in keyof Merge<KnownMappedKeys<T>, KnownMappedKeys<P>> as Exclude<Key, K>]: Merge<KnownMappedKeys<T>, KnownMappedKeys<P>>[Key]
    }, T[K]>
}

// resolver
export type Resolver<C extends AnyHollywood | undefined> = (keyof inferContainer<C> & string) | InstantiableConstructor<inferContainer<C>, any> | InitFactory<inferContainer<C>, any>
type inferInstanceFromResolver<C extends AnyHollywood | undefined, R extends Resolver<C>> = R extends InstantiableConstructor<infer _, infer T>
    ? T
    : R extends InitFactory<infer _, infer T>
    ? T
    : R extends keyof inferContainer<C>
    ? inferContainer<C>[R]
    : never

// instances
type ExtractContainer<C extends AnyHollywood> = C extends Hollywood<infer T, infer P>
    ? P extends AnyHollywood
    ? IsAny<P> extends true ? never : Merge<KnownMappedKeys<T>, ExtractContainer<P>>
    : T
    : never

type Instances<T extends Record<string, any>, P extends AnyHollywood | undefined> = Merge<T, P extends AnyHollywood ? ExtractContainer<P> : never>
export type inferContainer<T extends AnyHollywood | undefined> = T extends Hollywood<infer TContainer, infer P>
    ? { [K in keyof Instances<KnownMappedKeys<TContainer>, P> as KnownKey<K> & string]: Instances<KnownMappedKeys<TContainer>, P>[K] }
    : never

export type AnyHollywood = Hollywood<any, any>

export class Hollywood<
    T extends Record<string, any>,
    P extends AnyHollywood | undefined = undefined,
> {
    private readonly root: AnyHollywood
    private readonly parent?: P
    private readonly instancesStore = new Map<string, any>()
    private readonly tokenStore = new Map<string, Token<Instances<T, P>, any>>()
    private readonly tokenInitRefStore = new Map<Token<Instances<T, P>, any>["init"], string>()
    private readonly resolutionChain: string[] = []
    private readonly id: number
    private lastId = 0 // last issued id is tracked by the root container

    public readonly instances: Instances<T, P> = new Proxy({} as Instances<T, P>, {
        get: (_, prop) => {
            return this.resolve(prop as unknown as Resolver<Hollywood<T, P>>)
        },
        ownKeys: () => {
            const tokens = this.getAllTokens()
            return [...tokens]
        },
        getOwnPropertyDescriptor: () => {
            return {
                enumerable: true,
                configurable: true,
            }
        },
    })

    private constructor(tokens: RegisterTokens<T, inferContainer<P>>, parent: P) {
        // set container parent and root
        if (parent) {
            this.parent = parent
            this.root = parent.root
        } else {
            this.root = this
        }

        // set container id to lastId and increment for next call, this sets the root container id to 0
        this.id = this.root.lastId++

        // register tokens
        for (const [name, registerToken] of Object.entries(tokens) as [string, RegisterToken<Instances<T, P>, any>][]) {
            // if constructor is provided, register as scoped
            const token = typeof registerToken === "function" ? scoped(registerToken) : registerToken

            this.tokenStore.set(name, token)

            // tag non-transient token initializers reference
            if (token.scope !== "transient") this.tokenInitRefStore.set(token.init, name)
        }

        // eagerly store token instances by resolving them once
        for (const [name, token] of this.tokenStore.entries()) {
            if (token.scope !== "transient") this.resolve(name as unknown as Resolver<Hollywood<T, P>>)
        }
    }

    /**
     * Create root DI Container.
     * @param tokens registration tokens.
     */
    public static create<T extends Record<string, any>>(tokens: RegisterTokens<T, {}>): Hollywood<T> {
        return new Hollywood(tokens, undefined)
    }

    /**
     * Create child DI Container.
     * @param parent parent DI Container.
     * @param tokens registration tokens.
     */
    public static createWithParent<T extends Record<string, any>, P extends AnyHollywood>(parent: P, tokens: RegisterTokens<T, inferContainer<P>>): Hollywood<T, P> {
        return new Hollywood(tokens, parent)
    }

    /**
     * Create child container from this container.
     * 
     * Child container will be able to resolve all tokens it's parent container can resolve.
     * 
     * NOTE: `scoped` instances will be scoped to the child container only.
     * @param tokens registration tokens.
     */
    public createChild<TContainer extends Record<string, any>>(tokens: RegisterTokens<TContainer, inferContainer<this>>): Hollywood<TContainer, this> {
        return Hollywood.createWithParent(this, tokens)
    }

    /**
     * Resolve token instance by name or class.
     * 
     * This will return the instance of the token from the current container.
     * If a token was not registered directly on this container it will recursively use constructors or factories from it's parent container.
     * 
     * NOTE: `singletons` are stored in the root container only and for `transients` new instances are created everytime.
     * 
     * A class resolver must either have an empty constructor or must have a static `init` method to instantiate itself.
     */
    public resolve<R extends Resolver<Hollywood<T, P>>>(resolver: R): inferInstanceFromResolver<Hollywood<T, P>, R> {
        try {
            // resolve init factory or constructor by getting name from init tag
            if (typeof resolver !== "string") {
                // resolve init factory
                if (typeof resolver === "object") {
                    // recursively get init ref tag
                    const name = this.getTokenInitRefTag(resolver.init)
                    // resolve token instance with name from init tag
                    if (name) return this.resolve(name as unknown as Resolver<Hollywood<T, P>>)

                    // create new instance with factory without storing
                    return resolver.init(this.instances as unknown as inferContainer<Hollywood<T, P>>)
                }

                // recursively get init ref tag
                const name = this.getTokenInitRefTag(resolver)
                // resolve token instance with name from init tag
                if (name) return this.resolve(name as unknown as Resolver<Hollywood<T, P>>)

                // create new instance with constructor without storing
                return Hollywood.initConstructor(resolver, this.instances as unknown as inferContainer<Hollywood<T, P>>)
            }

            // check for stored instance in current container
            const hasStoredInstance = this.instancesStore.has(resolver)
            if (hasStoredInstance) return this.instancesStore.get(resolver) as Instances<T, P>[R & string]

            // check for circular dependency error
            if (this.resolutionChain.includes(resolver)) throw new ResolutionError("CircularDependency", resolver)
            this.resolutionChain.push(resolver) // add to resolution chain

            // if no stored instance get new token instance and store it where appropriate
            const instance = this.getAndStoreTokenInstance(resolver)

            this.resolutionChain.pop() // remove from resolution chain only after getting instance
            return instance
        } catch (err) {
            if (err instanceof ResolutionError) {
                if (err.reason === "CircularDependency") {
                    throw new Error(`Circular dependency '${err.dependency}' found while resolving ${this.resolutionChain.reverse().join(" => ")}`)
                }
                if (err.reason === "UnregisteredToken") {
                    throw new Error(`Unresolved dependency '${err.dependency}', did you register this token in this container or in a parent container?`)
                }
            }
            throw err
        }
    }

    private getAndStoreTokenInstance<K extends keyof Instances<T, P> & string>(name: K): Instances<T, P>[K] {
        const token = this.tokenStore.get(name)
        if (token) {
            // if token is singleton check for instance in root container before creating
            // store singletons with their container depth so that singletons of same token name do not override those from other containers
            let instance: Instances<T, P>[K]

            if (token.scope === "singleton" && this.root.instancesStore.has(name + `@${this.id}`)) {
                instance = this.root.instancesStore.get(name + `@${this.id}`)
            } else {
                instance = token.type === "factory" ? token.init(this.instances) : Hollywood.initConstructor(token.init, this.instances)
            }

            if (token.scope === "singleton") this.root.instancesStore.set(name + `@${this.id}`, instance)
            if (token.scope === "scoped") this.instancesStore.set(name, instance)
            // do not store transient

            return instance
        }

        // check in parent container
        if (this.parent) return this.parent.getAndStoreTokenInstance(name)

        throw new ResolutionError("UnregisteredToken", name)
    }

    private getTokenInitRefTag(initRef: Token<Instances<T, P>, any>["init"]): string | undefined {
        const name = this.tokenInitRefStore.get(initRef)
        if (name !== undefined) return name
        // check in parent container
        if (this.parent) return this.parent.getTokenInitRefTag(initRef)
        return undefined
    }

    /**
     * Recursively get all token names stored in this container and it's parent.
     */
    private getAllTokens(acc?: Set<string>): Set<string> {
        const keys = new Set([...(acc ?? []), ...this.tokenStore.keys()])
        if (!this.parent) return keys
        return this.parent.getAllTokens(keys)
    }

    /**
     * Instantiate constructor using it's static `init` method.
     * 
     * This will throw an UnresolvedDependencyError when the `init` method tries to access a missing dependency from the container.
     * @throws
     */
    public static initConstructor<T, U>(constructor: InstantiableConstructor<T, U>, instances: T): U {
        return "init" in constructor ? constructor.init(instances) : new constructor()
    }
}
