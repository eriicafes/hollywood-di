import { ResolutionError } from "./errors"
import { scoped } from "./helpers"
import { IsAny, KnownMappedKeys, Merge } from "./types/utils"

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
export type RegisterTokens<TContainer extends Record<string, any>, PContainer extends Record<string, any>> = {
    [K in keyof TContainer]: Merge<TContainer, PContainer> extends infer U extends Record<string, any> ? RegisterToken<KnownMappedKeys<Omit<U, K>>, TContainer[K]> : never
}

// infer
export type InferContainer<T extends AnyHollywood> = T extends Hollywood<infer TContainer, infer P>
    ? P extends AnyHollywood
    ? IsAny<P> extends true ? never : KnownMappedKeys<Merge<TContainer, InferContainer<P>>>
    : TContainer
    : never

// resolver
export type Resolver<T extends AnyHollywood> = (keyof InferContainer<T> & string) | InstantiableConstructor<InferContainer<T>, any> | InitFactory<InferContainer<T>, any>
type inferInstanceFromResolver<T extends AnyHollywood, R extends Resolver<T>> = R extends InstantiableConstructor<infer _, infer T>
    ? T
    : R extends InitFactory<infer _, infer T>
    ? T
    : R extends keyof InferContainer<T>
    ? InferContainer<T>[R]
    : never

export type AnyHollywood = Hollywood<any, any>

export class Hollywood<
    T extends Record<string, any>,
    P extends AnyHollywood | undefined = undefined,
> {
    private readonly root: AnyHollywood
    private readonly parent?: P
    private readonly instancesStore = new Map<string, any>()
    private readonly singletonInstancesStore = new Map<`${string}@${number}`, any>()
    private readonly tokenStore = new Map<Extract<Resolver<this>, string>, Token<InferContainer<this>, any>>()
    private readonly tokenInitNameStore = new Map<Token<InferContainer<this>, any>["init"], string>()
    private readonly resolutionChain: string[] = []
    private readonly id: number
    private lastId = 0 // last issued id is tracked by the root container

    public readonly instances: InferContainer<this> = new Proxy({} as InferContainer<this>, {
        get: (_, prop) => {
            return this.resolve(prop as Resolver<this>)
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

    private constructor(tokens: RegisterTokens<T, P extends AnyHollywood ? InferContainer<P> : never>, parent: P) {
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
        for (const [name, registerToken] of Object.entries(tokens) as [Extract<Resolver<this>, string>, RegisterToken<InferContainer<this>, any>][]) {
            // if constructor is provided, register as scoped token
            const token = typeof registerToken === "function" ? scoped(registerToken) : registerToken

            this.tokenStore.set(name, token)

            // tag non-transient token initializers
            if (token.scope !== "transient") this.tokenInitNameStore.set(token.init, name)
        }

        // eagerly store token instances by resolving them once
        for (const [name, token] of this.tokenStore.entries()) {
            if (token.scope !== "transient") this.resolve(name)
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
    public static createWithParent<T extends Record<string, any>, P extends AnyHollywood>(parent: P, tokens: RegisterTokens<T, InferContainer<P>>): Hollywood<T, P> {
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
    public createChild<TContainer extends Record<string, any>>(tokens: RegisterTokens<TContainer, InferContainer<this>>): Hollywood<TContainer, this> {
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
    public resolve<R extends Resolver<this>>(resolver: R): inferInstanceFromResolver<this, R> {
        try {
            // resolve init factory or constructor
            if (typeof resolver !== "string") {
                // resolve token instance with name if reference exists in this container
                let name: string | undefined = undefined
                if (typeof resolver === "function") {
                    // get init name tag from constructor
                    name = this.tokenInitNameStore.get(resolver)
                } else {
                    // get init name tag from factory
                    name = this.tokenInitNameStore.get(resolver.init)
                }
                if (name) return this.resolve(name as R)
                // else create new instance without storing
                return Hollywood.init(resolver, this.instances)
            }

            // check for stored instance in current container
            // check for existence first using has to cover situations where the stored instance is actually undefined
            const hasStoredInstance = this.instancesStore.has(resolver)
            if (hasStoredInstance) return this.instancesStore.get(resolver)

            // check for circular dependency error
            if (this.resolutionChain.includes(resolver)) throw new ResolutionError("CircularDependency", resolver)
            this.resolutionChain.push(resolver) // add to resolution chain

            // if no stored instance get new token instance
            const [instance, scope] = this.getTokenInstance(resolver as Extract<R, string>)
            // store scoped instances in the original resolving container
            if (scope === "scoped") this.instancesStore.set(resolver, instance)

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

    private getTokenInstance<K extends Extract<Resolver<this>, string>>(name: K): [InferContainer<this>[K], Scope] {
        const token = this.tokenStore.get(name)
        if (!token) {
            // check in parent container
            if (this.parent) return this.parent.getTokenInstance(name)
            throw new ResolutionError("UnregisteredToken", name)
        }

        // if token is singleton check for instance in root container before creating
        // store singletons with their container depth so that singletons of same token name do not override those from other containers
        if (token.scope === "singleton") {
            const exists = this.root.singletonInstancesStore.has(`${name}@${this.id}`)
            if (!exists) {
                const instance = token.type === "constructor" ? Hollywood.init(token.init, this.instances) : Hollywood.init(token, this.instances)
                this.root.singletonInstancesStore.set(`${name}@${this.id}`, instance)
            }
            return [this.root.singletonInstancesStore.get(`${name}@${this.id}`), token.scope]
        }

        const instance = token.type === "constructor" ? Hollywood.init(token.init, this.instances) : Hollywood.init(token, this.instances)
        return [instance, token.scope]
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
     * Instantiate a token or constructor.
     */
    public static init<T, U>(token: InstantiableConstructor<T, U> | InitFactory<T, U>, instances: T): U {
        if (typeof token !== "function") return token.init(instances)
        return "init" in token ? token.init(instances) : new token()
    }
}
