import {world, system } from "@minecraft/server"
import { Map } from "./map_making"

function startLobbyCount() { // starts game count down and calls funtions to set everything up called from world.beforeEvents.itemUse.Subscribe (player que handler)
    world.setDynamicProperty("lobby_count_started", true)
    const readyPlayers = world.getPlayers({tags: "Ready"});
    let count = 31;
    system.runInterval(() => {
        count -- 
        for (const readyPlayer of readyPlayers) {
            readyPlayer.setActionBar(`Seconds till start game: ${count}`);
        }
    }, 20);
    if (count < 1) {
        count = 31
        world.setDynamicProperty("lobby_count_started", false)
        return
    }
}
function pickMap() {
    const maps = Map.allMaps
    const numOfMaps = maps.length
    const randomNum = Math.floor(Math.random() * numOfMaps + 1)
    const pickedMap = maps[randomNum - 1]
    return pickedMap
}

world.beforeEvents.itemUse.subscribe((event) => { //handles players queing for game calls pickMap() and startLobbyCount()
    const item = event.itemStack.typeId
    if (item === "b_minigames:join_game_item") {
        event.source.addTag("Ready")
        const players = world.getPlayers({tags: "Ready"});
        if (players.length > 2 && world.getDynamicProperty("lobby_count_started") === false) {
            startLobbyCount();
            const map = pickMap()
            const ParsedData = JSON.parse(map.mapData)
            const name = map.name
            const spawns = ParsedData.data.spawns
            const barriers = ParsedData.data.barriers
            const chests = ParsedData.data.chests
            const dimension = ParsedData.data.dimension
            const numOfPlayers = ParsedData.data.numOfPlayers
            //start game here using data to perform relevant actions

        };
    }
})
