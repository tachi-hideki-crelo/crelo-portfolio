# Temporary braces security fork

This is a local copy of `braces@3.0.3` (MIT, copyright Jon Schlinkert),
used only by development/build dependencies. The source files were copied
unchanged except for the following security changes:

- Bound parser nesting to 100 parentheses/braces.
- Bound the recursive compile, expand, append, and stringify walkers, plus
  caller-supplied AST parent traversal.
- Remove an upstream debug `console.log` in the compile walker.

This addresses [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
until an upstream patched release is available. `3.0.4-crelo.0` is a **local
fork version**, not an upstream release. Keep the override and regression tests
together; replace this fork with the official release once published and verified.
