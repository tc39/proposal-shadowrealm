import repairObjectAccessors from "./repair/objectAccessors";
import repairFunctionConstructors from "./repair/functionConstructors";

// locking down the environment
export function sanitize(sandbox) {

    const { confinedWindow } = sandbox;

    repairObjectAccessors(confinedWindow);
    repairFunctionConstructors(confinedWindow);
}