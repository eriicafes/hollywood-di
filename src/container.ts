import { ResolutionError } from "./errors"
import { scoped } from "./helpers"
import { HasIndexSignature, KnownMappedKeys, Merge, Pretty } from "./types"

// initializers
export type InitFactory<TContainer, T> = { init: (container: TContainer) => T }
type EmptyConstructor<T> = new () => T
type InitConstructor<TContainer, T> = (new (...args: any[]) => T) & InitFactory<TContainer, T>
export type InstantiableConstructor<TContainer, T> = InitConstructor<TContainer, T> | EmptyConstructor<T>

// options
export type TokenOptions<T> = {
    lazy?: boolean
    beforeInit?: () => void
    afterInit?: (instance: T) => void
}
export type ContainerOptions = {
    lazy?: boolean
}

// tokens
export type Scope = "singleton" | "scoped" | "transient"
export type TokenConstructor<TContainer, T> = TokenOptions<T> & { scope: Scope, type: "constructor", init: InstantiableConstructor<TContainer, T> }
export type TokenFactory<TContainer, T> = TokenOptions<T> & { scope: Scope, type: "factory", init: (container: TContainer) => T }
export type Token<TContainer, T> = TokenConstructor<TContainer, T> | TokenFactory<TContainer, T>
export type RegisterToken<TContainer, T> = Token<TContainer, T> | InstantiableConstructor<TContainer, T>
export type RegisterTokens<TContainer extends Record<string, any>, PContainer extends Record<string, any>> = {
    [K in keyof TContainer]: Merge<TContainer, PContainer> extends infer U
    ? RegisterToken<
        HasIndexSignature<U> extends true
        ? TContainer extends never ? PContainer : Pretty<Record<string, any> & Omit<KnownMappedKeys<U>, K>>
        : Pretty<Omit<KnownMappedKeys<U>, K>>,
        TContainer[K]
    >
    : never
}

// infer
export type InferContainer<T extends AnyHollywood> = T extends Hollywood<infer TContainer, infer PContainer>
    ? Merge<TContainer, PContainer>
    : never
export type InferTokens<T extends Record<string, RegisterToken<any, any>>> = {
    [K in keyof T]: T[K] extends RegisterToken<any, infer T> ? T : never
}

// resolver
export type Resolver<T extends Record<string, any>> = (keyof KnownMappedKeys<T> & string) | InstantiableConstructor<T, any> | InitFactory<T, any>
type InferInstanceFromResolver<T extends Record<string, any>, R extends Resolver<T>> = R extends InstantiableConstructor<infer _, infer T>
    ? T
    : R extends InitFactory<infer _, infer T>
    ? T
    : R extends keyof T
    ? T[R]
    : never

/**
 * Any container.
 */
export type AnyHollywood = Hollywood<any, any>
/**
 * Any container that can resolve T.
 */
export type HollywoodOf<T extends Record<string, any>> = Hollywood<T, any>

export class Hollywood<
    T extends Record<string, any>,
    P extends Record<string, any>,
> {
    private readonly options?: ContainerOptions
    private readonly root: AnyHollywood
    private readonly parent?: AnyHollywood
    private readonly instancesStore = new Map<string, any>()
    private readonly singletonInstancesStore = new Map<`${string}@${number}`, any>()
    private readonly tokenStore = new Map<string, Token<any, any>>()
    private readonly tokenInitNameStore = new Map<Token<any, any>["init"], string>()
    private readonly resolutionChain: string[] = []
    private readonly id: number
    private lastId = 0 // last issued id is tracked by the root container

    public readonly instances: Merge<T, P> = new Proxy({} as Merge<T, P>, {
        get: (_, prop) => {
            return this.resolve(prop as Resolver<Merge<T, P>>)
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

    private constructor(tokens: RegisterTokens<T, P>, parent: Hollywood<P, any> | undefined, options?: ContainerOptions) {
        this.options = options
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
        for (const [name, registerToken] of Object.entries(tokens) as [Extract<Resolver<this>, string>, RegisterToken<Merge<T, P>, any>][]) {
            // if constructor is provided, register as scoped token
            const token = typeof registerToken === "function" ? scoped(registerToken) : registerToken

            this.tokenStore.set(name, token)

            // tag non-transient token initializers
            if (token.scope !== "transient") this.tokenInitNameStore.set(token.init, name)
        }

        // eagerly store token instances by resolving them once
        for (const [name, token] of this.tokenStore.entries()) {
            if (token.scope !== "transient" && !(token.lazy ?? this.options?.lazy)) this.resolve(name as Resolver<Merge<T, P>>)
        }
    }

    /**
     * Create root container.
     * @param tokens registration tokens.
     */
    public static create<T extends Record<string, any> = {}>(tokens: RegisterTokens<T, {}>, options?: ContainerOptions): Hollywood<T, {}> {
        return new Hollywood(tokens, undefined, options)
    }

    /**
     * Create child container from a parent container.
     * @param parent parent container.
     * @param tokens registration tokens.
     */
    public static createWithParent<T extends Record<string, any> = {}, P extends AnyHollywood = AnyHollywood>(parent: P, tokens: RegisterTokens<T, InferContainer<P>>, options?: ContainerOptions): Hollywood<T, InferContainer<P>> {
        return new Hollywood(tokens, parent, options ?? parent.options)
    }

    /**
     * Create child container.
     * 
     * Child container will be able to resolve all tokens it's parent container can resolve.
     * @param tokens registration tokens.
     */
    public createChild<TContainer extends Record<string, any> = {}>(tokens: RegisterTokens<TContainer, InferContainer<this>>, options?: ContainerOptions): Hollywood<TContainer, InferContainer<this>> {
        return Hollywood.createWithParent(this, tokens, options)
    }

    /**
     * Resolve token instance by name, class constructor or factory function.
     * 
     * `scoped`: A unique instance scoped to the resolving container will be returned when resolving a scoped token.
     * 
     * `singleton`: A single shared instance will be returned when resolving a singleton token.
     * 
     * `transient`: A new instance will be returned everytime when resolving a transient token (even in the same container).
     * 
     * When creating an instance, if the token was not registered directly on this container it will use initializers from it's parent container to create the new instance.
     */
    public resolve<R extends Resolver<Merge<T, P>>>(resolver: R): InferInstanceFromResolver<Merge<T, P>, R> {
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

    private getTokenInstance<K extends keyof Merge<T, P> & string>(name: K): [any, Scope] {
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
                token.beforeInit?.()
                const instance = token.type === "constructor" ? Hollywood.init(token.init, this.instances) : Hollywood.init(token, this.instances)
                token.afterInit?.(instance)
                this.root.singletonInstancesStore.set(`${name}@${this.id}`, instance)
            }
            return [this.root.singletonInstancesStore.get(`${name}@${this.id}`), token.scope]
        }

        token.beforeInit?.()
        const instance = token.type === "constructor" ? Hollywood.init(token.init, this.instances) : Hollywood.init(token, this.instances)
        token.afterInit?.(instance)
        return [instance, token.scope]
    }

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
