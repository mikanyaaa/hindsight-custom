# Brain geometry (implementation step 1)

Source plan: the private development repo (PR #1),
`docs/plan-amendments` at `295c29f59ec6fe04a5a82883d682dc7633858ef2`:
`docs/plans/AMENDMENTS-2026-10-15.md` and `docs/plans/ai-brain-network-v2.md`.
This branch starts at `origin/main`, without merging the documentation branch.

`createBrainLayout` accepts readonly IDs and optional stable group keys, and returns
source coordinates, fixed projected coordinates/depth and geometry-wide bounds.
All coordinates are normalised, independent of pixels, viewport or visible node
count. Input order is preserved; duplicate IDs are rejected. An absent group and
an empty group are distinct. Changing a group intentionally changes the position.

The original cubic contours have a crown, lobes, basal indentation and separated
hemispheres. Rounded thickness and a fixed orthographic yaw/pitch supply 2.5D depth.
Fissure and furrows are decorative geometry, never memories or biological regions.
An empty input produces no nodes. No UI, renderer, adapter, flag, storage, network
or authentication integration exists in this step.

Sampling uses at most 12 candidates per ID, then a guaranteed interior rectangle
with independently hashed offsets. Every dimension hashes the full structured
identity again, so a primary 32-bit hash collision does not collapse a whole
position. There is no neighbour-dependent displacement or minimum pixel spacing
guarantee; arbitrarily close points remain possible in a continuous layout. Work
is linear in node count for this fixed geometry. Bump `BRAIN_GEOMETRY_VERSION`
whenever geometry, projection, hashing or sampling changes.

## Configuration register

No application integration hooks exist. The following minimal infrastructure
changes outside this directory are required for this first implementation:

| File                                       | Marker / change                               | Purpose                                                                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hindsight-control-plane/vitest.config.ts` | `CUSTOM-HOOK: brain-test-discovery begin/end` | Add `src/custom/brain/__tests__/**/*.test.ts` while preserving existing patterns. `npm test` discovers these tests; knip's Vitest plugin follows their imports into the otherwise unconnected modules. No ignore/entry exemption. |
| `.github/workflows/test.yml`               | `detect-changes.permissions.contents: read`   | Allow checkout in the private mirror alongside the existing PR read permission. No checks disabled.                                                                                                                               |

Run the control plane's standard `npm test`, not an ad-hoc alternate test config.
Knip's blocking check is `npx --yes knip@5 --no-progress --include files,dependencies,unlisted`
from `hindsight-control-plane/`. Repository lint/dead-code scripts, TypeScript,
tests, build and the local code-review workflow are required before push/PR.
