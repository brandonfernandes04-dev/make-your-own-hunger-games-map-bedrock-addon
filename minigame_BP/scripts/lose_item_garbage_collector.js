import {world, system} from "@minecraft/server"

export class garbageCollector {
    constructor() {}
    static async removeItems(dimension) {
        const items = dimension.getEntities({type: "item"})
        for (const item of items) {
            item.remove()
        }
        world.setDynamicProperty('garbageCollectorCurrentProcess')
    }
}
