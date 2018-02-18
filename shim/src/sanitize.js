import { repairAccessors } from "./accessors";

// locking down the environment
export function sanitize(sandbox) {

    const { confinedWindow: { Object: { prototype: objProto } } } = sandbox;

    repairAccessors(objProto);
    // TODO: other steps
}