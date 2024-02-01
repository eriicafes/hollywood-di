# Hollywood DI

📦 Typesafe Dependency Injection for typescript with zero decorators.

Hollywood is desgined to be simple. A class / factory function determines its dependencies and it can only be resolved by a container if that container holds all it's required dependencies.

As long as this requirement is met, the container will take control of creating the instance. Dependencies are statically checked with typescript at compile time.

## Installation

```sh
npm i hollywood-di
```

## Usage

```ts
import { factory, Hollywood } from "hollywood-di";

class Example {
  public greet() {
    console.log("hello world");
  }
}

const container = Hollywood.create({
  classExample: Example,
  factoryExample: factory(() => "ping pong"),
});

// resolve registered token by name
const classExample = container.resolve("classExample");

// resolve registered token using constructor
const classExample2 = container.resolve(Example);

// access instance directly from the container
const factoryExample = container.instances.factoryExample;
```

## Containers

A container is responsible for registering and resolving tokens. Containers may create child containers which can register their own tokens.

```ts
import { Hollywood } from "hollywood-di";

const container = Hollywood.create({
  /// ...register tokens here
});

const childContainer = container.createChild({
  // ...register child tokens here
});

// NOTE: a child container can resolve every token it's parent container can resolve
```

### Lazy Containers

By default, registered tokens are eagerly resolved before they are first accessed. To change this behaviour create the container as lazy. Containers will inherit their lazy option form parent containers.

NOTE: Token lazy option superceeds the container option.

```ts
// lazy container
const container = Hollywood.create(
  {
    // ...register tokens
  },
  { lazy: true }
);

// this container is lazy, as inherited from its parent
const childContainer = Hollywood.create({
  // ...register tokens
});
```

## Tokens

### Registration

Tokens are registered on a container after which they can be resolved using their name, class constructor or factory function.

NOTE: When resolving a class constructor or factory function, the container will only return an existing instance if it was directly registered on the container, otherwise a new instance will be created and returned. Resolving by name does not share this behaviour.

Example using a factory:

```ts
const userFactory = factory(() => ({ role: "user" }));

const container = Hollywood.create({
  user: userFactory,
});

const user1 = container.resolve("user");
const user2 = container.resolve(userFactory);
// user1 === user2
```

Example using a class:

```ts
class Car {}

const container = Hollywood.create({
  car: Car,
});

const car1 = container.resolve("car");
const car2 = container.resolve(Car);
// car1 === car2
```

A class can only be used as a token if it has exactly zero constructor parameters or a static init function that returns an instance of the class.

```ts
class Car {}

class Color {
  constructor(public hex: string) {}
}

class Person {
  public static init(container: { car: Car }) {
    return new Person(container.car);
  }
  constructor(public car: Car) {}
}

const container = Hollywood.create({
  car: Car, // valid ✅
  color: Color, // invalid ❌
  person: Person, // valid ✅
});
```

### Dependencies

Registered tokens describe their dependencies and the container will ensure those dependencies are provided.

```ts
class Chef {
  public cook(meal: string) {}
}

class Waiter {
  public serve(meal: string) {}
}

class Restaurant {
  public static init(ctx: { chef: Chef; waiter: Waiter }) {
    return new Restaurant(ctx.chef, ctx.waiter);
  }

  constructor(private chef: Chef, private waiter: Waiter) {}

  public orderMeal(meal: string) {
    this.chef.cook(meal);
    this.waiter.serve(meal);
  }
}

const container = Hollywood.create({
  chef: Chef,
  waiter: Waiter,
  restaurant: Restaurant,
});

const restaurant = container.resolve("restaurant");
restaurant.orderMeal("🍜");
```

In the example above, the container automatically injects the chef and waiter to the restaurant.

### Define Init (class helper)

In the previous example, the kitchen initializer can be simplified as below:

```ts
import { defineInit } from "hollywood-di";

// other code here

class Restaurant {
  public static init = defineInit(Restaurant).args("chef", "waiter");

  constructor(private chef: Chef, private waiter: Waiter) {}

  // other methods here
}
```

this is a shorthand for specifying the name of the token in the container which will hold the value for each argument in the class constructor.

### Lazy Tokens

By default a token is eagerly resolved, except overriden on the container. To change this behaviour register the token as lazy.

NOTE: Token lazy option superceeds the container option.

```ts
const container = Hollywood.create({
  // this token will be lazily resolved
  example: factory(() => "hello world", { lazy: true }),
});

// lazy container
const container = Hollywood.create(
  {
    // this token will be eagerly resolved
    example: factory(() => "hello world", { lazy: false }),
  },
  { lazy: true }
);
```

NOTE: when resolving a token, all dependencies of the token will also be resolved, hence, an eagerly resolved token in a lazy container may also eagerly resolve other tokens.

### Init Hooks

Registered tokens can have init hooks that are called before and after an instance of that token is created.

```ts
const container = Hollywood.create({
  example: factory(() => "hello world", {
    beforeInit() {
      console.log("before example init");
    },
    afterInit(instance) {
      console.log(instance); // instance === "hello world"
    },
  }),
});
```

### Scope

Tokens registered in containers can have one of three scopes:

```ts
type Scope = "singleton" | "scoped" | "transient";
```

- `Scoped`: the same instance is shared in each container.

- `Singleton`: a single instance is shared across all containers.

- `Transient`: a new instance is created everytime.

## Examples

[JWT Auth](./examples/jwt-auth.md)
