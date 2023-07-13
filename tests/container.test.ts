import { describe, expect, it } from "vitest"
import { Hollywood } from "../src"

describe("Container", () => {
    class Counter {
        public count = 0
        public increment() {
            this.count++
        }
    }

    class ForwardCounter {
        public counter: Counter
        constructor(container: { counter: Counter }) {
            this.counter = container.counter
        }
    }

    const container = Hollywood.create({
        counter: Counter,
        forwardCounter: ForwardCounter
    })

    it("should resolve instance from container", () => {
        const counter = container.resolve("counter")
        expect(counter.count).toBe(0)

        counter.increment()
        expect(counter.count).toBe(1)
    })

    it("should reuse same instance for injected dependencies", () => {
        const forwardCounter = container.resolve(ForwardCounter)
        const counter = container.resolve("counter")

        expect(forwardCounter.counter).toBe(counter)
    })
})
