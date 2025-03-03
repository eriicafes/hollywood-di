# hollywood-di

## 0.6.1

### Patch Changes

- 18a28d3: Expose types

## 0.6.0

### Minor Changes

- e3e944e: Use constructor argument for class alongside static init method

## 0.5.2

### Patch Changes

- 796e313: Use property syntax over method syntax for InitFactory type

## 0.5.1

### Patch Changes

- ab7dca7: Fix Merge type

## 0.5.0

### Minor Changes

- 5d3bf4c: Add InferTokens type

## 0.4.0

### Minor Changes

- bef4575: Child container can now be assigned to a type of it's parent container as long as it does not override the parent structure

## 0.3.1

### Patch Changes

- 455fb1d: Fixed bug where resolving factory or constructor registered on a parent container would incorrectly resolve to a wrong instance with a similar name in the resolving container

## 0.3.0

### Minor Changes

- 831ff9f: Drop support for ProxyConstructor

## 0.2.1

### Patch Changes

- 41fe871: Expose `RegisterTokens` type

## 0.2.0

### Minor Changes

- 32a626c: Improve `alias()` type inference for both typed and inferred containers using function overloading
- 32a626c: Support resolving factory functions with `container.resolve()`
  The same instance will be returned as long as same reference for the factory function is provided.

## 0.1.2

### Patch Changes

- c5355e9: Fix reusing stored class instance when resolving class constructor

## 0.1.1

### Patch Changes

- e785777: Setup initial API and configure CI
