# Alpha 2.6.2 · Swamp Frog

Built from Alpha 2.6.1 Equipment / Character Preview.

The playable hero and inventory/equipment viewer now use the supplied Swamp Frog mesh, skin weights, skeleton and native animation clips. The original model is preserved as assets/models/swamp-frog.glb. Animation root translation is removed at runtime so gameplay controls movement and collisions.

Idle, walk/run, light/heavy attacks and death use supplied clips. Casting, blocking, flask use and dodge currently reuse casting/jump clips. Hit reactions use the idle pose with the existing gameplay stagger effect. These are temporary mappings pending bespoke animations.

Temporary sword and shield geometry follows the supplied hand bones and appears only when the relevant inventory slot is equipped. Body armor and item-specific weapon assets are not fitted in this pass. The primitive character builder remains available; its species silhouettes are conceptual previews and do not replace this new gameplay body.

Open rig-test.html on the same server for a Swamp Frog animation inspection, including skin weights, skeleton, rest pose and attack clips. The normal equipment window shows the same base asset in a separate skeleton instance.

Verification: existing regression suite plus native skin/animation sampling, skeleton cloning, root position stability, pose adapters and equipment visibility. Browser visual review was not available in this environment; check ground contact, facing, sword/shield fit and motion transitions in your playtest.

Run locally: python3 -m http.server 8000, then open http://localhost:8000/.
