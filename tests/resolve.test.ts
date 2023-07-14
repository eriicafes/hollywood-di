import { describe, expect, it } from "vitest"
import { factory, Hollywood } from "../src"

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

        expect(stringResolvedCounter).toBe(factoryResolvedCounter)
    })

    it("should resolve similar factories with different instance", () => {
        const counter = factory(() => {
            return new Counter()
        })

        const container = Hollywood.create({
            counter,
        })

        const stringResolvedCounter = container.resolve("counter")
        const factoryResolvedCounter = container.resolve(factory(() => {
            return new Counter()
        }))

        expect(stringResolvedCounter).not.toBe(factoryResolvedCounter)
    })
})
