import {world, system, TickingAreaManager } from "@minecraft/server"
import { Map } from "./map_making"

function startLobbyCount( players ) { // start game count down 
    const Players = players
    let count = 31;
    system.runInterval(() => {
        count -- 
        Players.forEach(player => {
            player.onScreenDisplay.setActionBar(`Game begins: ${count}`)
        });
    }, 20);
    if (count < 1) {
        count = 31
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
    const randomNum = Math.floor(Math.random() * validMaps.length)
    const pickedMap = validMaps[randomNum]
    return pickedMap
}

async function* setBarriers(barriers, dimension) {
    for (let i = 0; i < barriers.length; ) {
        const barrier = barriers[i]
        const [x, y, z] = barrier
        const isBarrierLoaded = dimension.isChunkLoaded({x: x, y: y, z: z})
        if (!isBarrierLoaded) {
           await TickingAreaManager.createTickingArea('working_area', {from: {x, y, z}, to: {x, y, z}})
           dimension.setBlockType({x: x, y: y, z: z}, "minecraft:barrier")
           yield;
           const nextBarrierIndex = barriers[i++]
           if (!nextBarrierIndex) return;
           const [x2, y2, z2] = nextBarrierIndex
           if(dimension.isChunkLoaded({x: x2, y: y2, z: z2})) {
                dimension.setBlockType({x: x2, y: y2, z: z2}, "minecraft:barrier")
                TickingAreaManager.removeTickingArea("working_area")
                i += 2
           }
           else {i++; yield;}
        }
    }
}

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
            await fillChests(chests, dimension) //need to write
            await startLobbyCount(players);
            const spawns = parsedData.spawns;
            MovePlayers(spawns, dimension) //need to write
            const numOfTicks = parsedData.numOfTicks; //Create game timer using this data
        }
    }
})


