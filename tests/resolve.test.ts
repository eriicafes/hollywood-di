import { describe, expect, it } from "vitest"
import { alias, factory, Hollywood } from "../src"

describe("Resolve", () => {
    class Counter {
        public count = 0
        public increment() {
            this.count++
        }
    }

    it("should register and resolve factory with same instance", () => {
        const counter = factory(() => {
            return new Counter()
        })

        const container = Hollywood.create({
            counter,
        })

        const stringResolvedCounter = container.resolve("counter")
        const factoryResolvedCounter = container.resolve(counter)
        const similarFactoryResolvedCounter = container.resolve(factory(() => {
            return new Counter()
        }))

        expect(stringResolvedCounter).toBe(factoryResolvedCounter)
        expect(stringResolvedCounter).not.toBe(similarFactoryResolvedCounter)
        expect(factoryResolvedCounter).not.toBe(similarFactoryResolvedCounter)
    })

    it("should resolve alias with same instance", () => {
        const typedContainer = Hollywood.create<{ counter: Counter, counter2: Counter, counterAlias: Counter }>({
            counter: factory(() => new Counter()),
            counter2: Counter,
            counterAlias: alias("counter"),
        })

        const tCounter = typedContainer.resolve("counter")
        const tCounterAlias = typedContainer.resolve("counterAlias")
        expect(tCounter).toBe(tCounterAlias)

        const inferredContainer = Hollywood.create({
            counter: factory(() => new Counter()),
            counter2: Counter,
            counterAlias: alias<{ counter: Counter }>().to("counter"),
        })
        const iCounter = inferredContainer.resolve("counter")
        const iCounterAlias = inferredContainer.resolve("counterAlias")
        expect(iCounter).toBe(iCounterAlias)
    })
})
