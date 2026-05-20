import {world, system} from "@minecraft/server"

export class garbageCollector {
    constructor() {}
    static locations = []
    static cacheRemaining() {
        if (this.locations.length < 1) {return};
        const remaining = JSON.stringify(this.locations)
        world.setDynamicProperty('garbageCollectorToDo', remaining)
    }
    static async removeItems() {
        for (const location of this.locations) {
            const coordinates = location.coordinates
            const dimension = world.getDimension(location.dimension)
            if (!dimension.isChunkLoaded(coordinates)) {
                await world.tickingAreaManager.createTickingArea('garbageCollector', {from: coordinates, to: coordinates, dimension: dimension})
            }
            const items = dimension.getEntities({location: coordinates, maxDistance: 16, type: "item"})
            if (items.length !== 0) {
                for (const item of items) {
                    console.warn(JSON.stringify(item))
                    item.remove()
                }
            }
            if (world.tickingAreaManager.getTickingArea('garbageCollector')) {
                world.tickingAreaManager.removeTickingArea('garbageCollector')
            }
            garbageCollector.cacheRemaining()
        }
        this.locations.length = 0
        world.setDynamicProperty('garbageCollectorToDo')
        world.setDynamicProperty('garbageCollectorCurrentProcess')
    }
}

world.afterEvents.entityDie.subscribe((event) => {
    if (event.deadEntity.hasTag('inGame')) {
        const location = event.deadEntity.location
        const dimension = event.deadEntity.dimension.id
        const timeStamp = system.currentTick
        const data = {coordinates: location, dimension: dimension}
        garbageCollector.locations.push(data)
        garbageCollector.cacheRemaining()
    }
})

world.afterEvents.entityItemDrop.subscribe((event) => {
    if (event.entity.hasTag('inGame')) {
        const location = event.entity.location
        const dimension = event.entity.dimension.id
        const timeStamp = system.currentTick
        const data = {coordinates: location, dimension: dimension}
        garbageCollector.locations.push(data)
        garbageCollector.cacheRemaining()
    }
})