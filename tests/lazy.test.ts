import { describe, expect, it, test, vi } from "vitest";
import { factory, Hollywood } from "../src";

describe("Lazy", () => {
  it("should eagerly initialize container", () => {
    const mockFn = vi.fn(() => "item");

    Hollywood.create({
      item: factory(mockFn),
    });

    expect(mockFn).toBeCalledTimes(1);
  });

  it("should lazily initialize container", () => {
    const mockFn = vi.fn(() => "item");

    const container = Hollywood.create(
      {
        item: factory(mockFn),
      },
      { lazy: true }
    );

    expect(mockFn).toBeCalledTimes(0);

    container.resolve("item");
    expect(mockFn).toBeCalledTimes(1);
  });

  it("should prefer token lazy option over container lazy option", () => {
    const mockFn = vi.fn(() => "item");

    Hollywood.create(
      {
        item: factory(mockFn, { lazy: false }),
      },
      { lazy: true }
    );

    expect(mockFn).toBeCalledTimes(1);
  });

  it("should cascade container lazy option", () => {
    const mockFn1 = vi.fn(() => "item1");
    const mockFn2 = vi.fn(() => "item2");

    const container1 = Hollywood.create({}, { lazy: true });
    const container2 = container1.createChild({
      item1: factory(mockFn1),
    });
    const container3 = container2.createChild({}, { lazy: false });
    const container4 = container3.createChild({
      item2: factory(mockFn2),
    });

    expect(mockFn1).toBeCalledTimes(0);
    expect(mockFn2).toBeCalledTimes(1);
    container4.resolve("item1");
    container4.resolve("item2");
    expect(mockFn2).toBeCalledTimes(1);
    expect(mockFn2).toBeCalledTimes(1);
  });

  test("parent container tokens are always lazy", () => {
    // eager parent
    const mockFn1 = vi.fn(() => "item1");
    const container1 = Hollywood.create({
      item1: factory(mockFn1),
    });
    expect(mockFn1).toBeCalledTimes(1);
    const container2 = container1.createChild({}, { lazy: false });
    expect(mockFn1).toBeCalledTimes(1);
    const container3 = container1.createChild({}, { lazy: true });
    expect(mockFn1).toBeCalledTimes(1);
    container2.resolve("item1");
    expect(mockFn1).toBeCalledTimes(2);
    container3.resolve("item1");
    expect(mockFn1).toBeCalledTimes(3);

    // lazy parent
    const mockFn2 = vi.fn(() => "item2");
    const lazyContainer1 = Hollywood.create(
      {
        item1: factory(mockFn2),
      },
      { lazy: true }
    );
    expect(mockFn2).toBeCalledTimes(0);
    const lazyContainer2 = lazyContainer1.createChild({}, { lazy: false });
    expect(mockFn2).toBeCalledTimes(0);
    const lazyContainer3 = lazyContainer1.createChild({}, { lazy: true });
    expect(mockFn2).toBeCalledTimes(0);
    lazyContainer2.resolve("item1");
    expect(mockFn2).toBeCalledTimes(1);
    lazyContainer3.resolve("item1");
    expect(mockFn2).toBeCalledTimes(2);
  });

  it("should delay circular dependency error", () => {
    expect(() => {
      Hollywood.create({
        circular1: factory(
          (ctx: { circular2: string }) => "circular1" + ctx.circular2
        ),
        circular2: factory(
          (ctx: { circular1: string }) => "circular2" + ctx.circular1
        ),
      });
    }).toThrowError("Circular dependency");

    const circularContainer = Hollywood.create(
      {
        circular1: factory(
          (ctx: { circular2: string }) => "circular1" + ctx.circular2
        ),
        circular2: factory(
          (ctx: { circular1: string }) => "circular2" + ctx.circular1
        ),
      },
      { lazy: true }
    );
    expect(() => circularContainer.resolve("circular1")).toThrowError(
      "Circular dependency"
    );
  });
});
