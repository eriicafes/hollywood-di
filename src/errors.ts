export class ResolutionError extends Error {
    constructor(public reason: "CircularDependency" | "UnregisteredToken", public dependency: string) {
        super()
    }
}
