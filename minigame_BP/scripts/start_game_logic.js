import {world, system, TickingAreaManager } from "@minecraft/server"
import { Map } from "./map_making"

function startLobbyCount( players ) { // start game count down 
    let count = 31;
    system.runInterval(() => {
        count -- 
        players.forEach(player => {
            player.onScreenDisplay.setActionBar(`Game begins: ${count}`)
        });
    }, 20);
    if (count < 1) {
        world.setDynamicProperty("lobby_count_started", false)
        return
    }
}
function pickMap(numOfPlayers) { //Returns an instance of a class from the static property allMaps in the class Map based on a random number after ensuring the map is capable of handling the number of players in the que
    const allMaps = Map.allMaps
    const validMaps = allMaps.filter(map => {
        const data = JSON.parse(map.mapData)
        const maxPlayers = data.numOfPlayers
        if (maxPlayers >= numOfPlayers) {return true}
    })
    const randomNum = Math.floor(Math.random() * validMaps.length + 1)   
    const pickedMap = validMaps[randomNum]
    return pickedMap
}

async function* setbarriers(barriers, dimension) {
    if (barriers.length === 0) {
        return world.sendMessage("All Barriers Set")
    }
    const loadedSpaces = []
    let spacesLoaded = 0
    await TickingAreaManager.createTickingArea('working_area', {x: barriers[0][0], y: barriers[0][1], z: barriers[0][2]}, {dimension: dimension})
    if (barriers.length > 1) {
        for (const barrier of barriers) {
            const [x, y, z] = barrier
            const isLoaded = dimension.isChunkLoaded({x: x, y: y, z: z})
            if (isLoaded) {
                loadedSpaces.push(barrier)
                spacesLoaded ++
                yield;
            }
            if (!isLoaded) {
                break;
            }
        }
        for (const loadedSpace of loadedSpaces) {
            const [x, y, z] = loadedSpace
            dimension.setBlockType({x: x, y: y, z: z}, 'minecraft:barrier')
            yield;
        }
        barriers.splice(0, spacesLoaded)
        TickingAreaManager.removeTickingArea('working_area')
        yield;
        return system.runJob(setbarriers(barriers, dimension))
    }
    if (barriers.length === 1) {
        dimension.setBlockType({x: barriers[0][0], y: barriers[0][1], z: barriers[0][2]}, 'minecraft:barrier')
        TickingAreaManager.removeTickingArea('working_area')
        return world.sendMessage("All Barriers Set")
    }
}



function insertItems(inventory, items) {
    let currentSlot = 0
    for (const item of items) {
        if (currentSlot < 26) {
            inventory.setItem(0, item)
            const numberToIncrease = Math.floor(Math.random() * 3 + 1)
            currentSlot += numberToIncrease
        }
        if (currentSlot > 26) {
            const firstOpen = inventory.firstEmptySlot()
            inventory.setItem(firstOpen, item)
        }
    }
}

async function* resetAndFillChests(chests, dimension) {
    if (chests.length === 0) {
        return world.sendMessage('All chests filled')
    }
    const loadedChests = []
    let chestsLoaded = 0
    await TickingAreaManager.createTickingArea('working_area', {x: chests[0][0], y: chests[0][1], z: chests[0][2]}, {dimension: dimension})
        for (const chest of chests) {
            const [x, y, z] = chest
            const isLoaded = dimension.isChunkLoaded({x: x, y: y, z: z})
            if (isLoaded) {
                loadedChests.push(chest)
                chestsLoaded ++
                yield;
            }
            if (!isLoaded) {
                break;
            }
        }
        for (const loadedChest of loadedChests) {
            const [x, y, z] = loadedChest
            const block = dimension.getBlock({x: x, y: y, z: z})
            if (block.typeId === 'minecraft:chest') {
                const inventory = block.getComponent('minecraft:inventory').container
                yield;
                inventory.clearAll()
                const typeToFill = world.getDynamicProperty(loadedChest.toString())
                if (!typeToFill) {world.sendMessage(`Chest with no tier of loot assigned to it found at x: ${x}, y: ${y}, z: ${z} this chest will be skipped`); continue;}
                const manager = world.getLootTableManager()
                yield;
                switch (typeToFill) {
                    case "low":
                        const lowLootTable = manager.getLootTable("hunger_games/chests/low_tier_chest")
                        const lowLoot = manager.generateLootFromTable(lowLootTable)
                        yield insertItems(inventory, lowLoot); break;
                    case "mid":
                        const midLootTable = manager.getLootTable("hunger_games/chests/mid_tier_chest")
                        const midLoot = manager.generateLootFromTable(midLootTable)
                        yield insertItems(inventory, midLoot); break;
                    case "high":
                        const highLootTable = manager.generateLootFromTable("hunger_games/chests/mid_tier_chest")
                        const highLoot = manager.generateLootFromTable(highLootTable)
                        yield insertItems(inventory, highLoot); break;
                }
            }
            else {world.sendMessage(`A block that is not a chest was found at x: ${x}, y: ${y}, z: ${z} please be sure you have input the correct cooridinate.`)}
        }
        chests.splice(0, chestsLoaded);
        TickingAreaManager.removeTickingArea('working_area')
        yield* system.runJob(resetAndFillChests(chests, dimension))
    }

    function movePlayers(spawns, players, dimension) {
        let currentPlayerIndex = 0
        for (const spawn of spawns) {
            const [x, y, z] = spawn
            const currentPlayer = players[currentIndex]
            currentPlayer.teleport({x: x, y: y, z: z}, {dimension: dimension})
            currentPlayer.removeTag("Ready")
            currentPlayer.addTag('inGame')
            currentIndex++
        }
        return world.sendMessage('All players in position')
    }

    function* dropBarriers (barriers, players, dimension) { // start game count down 
    let count = 31;
    system.runInterval(() => {
        count -- 
        players.forEach(player => {
            player.onScreenDisplay.setActionBar(`Barriers Drop: ${count}`)
        });
    }, 20);
    if (count < 1) {
        world.setDynamicProperty("game_active", true)
        for (const barrier of barriers) {
            const [x, y, z] = barrier
            yield dimension.setBlockType({x: x, y: y, z: z}, 'minecraft:air')
        }
        return
    }
}


// async function* setBarriers(barriers, dimension) {
//     const loadedSpaces = []
//     let spacesLoaded = 0
//     await TickingAreaManager.createTickingArea('working_area', {x: barriers[0][0], y: barriers[0][1], z: barriers[0][2], dimension: dimension})
//     for (let i = 0; i < barriers.length;) {
//         const [x, y, z] = barriers[i]
//         const isLoaded = dimension.isChunkLoaded({x: x, y: y, z: z})
//         if (isLoaded) {
//             loadedSpaces.push([x, y, z])
//             i++
//             spacesLoaded++
//         }
//         if (!isLoaded) {
//             for (const loadedSpace of loadedSpaces) {
//                 const [x2, y2, z2] = loadedSpace
//                 dimension.setBlockType({x: x2, y: y2, z: z2}, "minecraft:barrier")
//                 yield;
//             }
//             TickingAreaManager.removeTickingArea('working_area')
//             barriers.splice(0, spacesLoaded)
//             if (barriers.length > 1) {
//                 await TickingAreaManager.createTickingArea('working_area', {x: barriers[0][0], y: barriers[0][1], z: barriers[0][2], dimension: dimension})
//                 i = 0
//             }
//             else {dimension.setBlockType({x: barriers[0][0], y: barriers[0][1], z: barriers[0][2], dimension: dimension}, 'minecraft:barrier')}
//         }

//     } 
// }

// async function* setBarriers(barriers, dimension) { //could be more efficent will probably rewrite
//     for (let i = 0; i < barriers.length; ) {
//         const barrier = barriers[i]
//         const [x, y, z] = barrier
//         const isBarrierLoaded = dimension.isChunkLoaded({x: x, y: y, z: z})
//         if (!isBarrierLoaded) {
//            await TickingAreaManager.createTickingArea('working_area', {from: {x, y, z}, to: {x, y, z}})
//            dimension.setBlockType({x: x, y: y, z: z}, "minecraft:barrier")
//            yield;
//            const nextBarrierIndex = barriers[i++]
//            if (!nextBarrierIndex) return;
//            const [x2, y2, z2] = nextBarrierIndex
//            if(dimension.isChunkLoaded({x: x2, y: y2, z: z2})) {
//                 dimension.setBlockType({x: x2, y: y2, z: z2}, "minecraft:barrier")
//                 TickingAreaManager.removeTickingArea("working_area")
//                 i += 2
//            }
//            else {i++; yield;}
//         }
//     }
// }

world.afterEvents.itemUse.subscribe((event) => { //handles players queing into the game by using the join game item
    const item = event.itemStack.typeId
    if (item === "b_minigames:join_game_item") {
        event.source.addTag("Ready")
    }
    else return;
})

world.afterEvents.itemUse.subscribe(async (event) => { //handles starting the game when any player uses the start game item and there is more than 1 player ready in the lobby.
    const item = event.itemStack.typeId
    if (item === "b_minigames:start_match_item" && world.getDynamicProperty("lobby_count_started") === false && world.getDynamicProperty("game_active") === false) {
        const players = world.getPlayers({tags: "Ready"});
        if (players.length > 2) {
            world.setDynamicProperty("lobby_count_started", true)
            world.sendMessage('Picking Map...')
            const map = await pickMap(players.length);
            const parsedData = JSON.parse(map.mapData); 
            const dimension = parsedData.dimension;
            const name = map.name;
            world.sendMessage(`Next map: ${name}`) //Tells the players what map they will be playing next
            const barriers = parsedData.barriers;
            world.sendMessage('Setting Barriers...')
            await system.runJob(setBarriers(barriers, dimension))
            const chests = parsedData.chests;
            world.sendMessage('filling chests...')
            await system.runJob(resetAndFillChests(chests, dimension))
            await startLobbyCount(players);
            const spawns = parsedData.spawns;
            await movePlayers(spawns, players, dimension)
            system.runJob(dropBarriers(barriers, players, dimension))
            const numOfTicks = parsedData.numOfTicks; //Create game timer using this data
        }
    }
})

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "b_minigames:tempFix") {
        world.setDynamicProperty("game_active", false)
        const players = world.getPlayers({tags: "inGame"})
        players.forEach(player => {
            player.removeTag('inGame')
        })
    } 
})
