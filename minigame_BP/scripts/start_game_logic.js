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
function pickMap() { //Returns an instance of a class from the static property allMaps in the class Map based on a random number
    const maps = Map.allMaps
    const numOfMaps = maps.length
    const randomNum = Math.floor(Math.random() * numOfMaps + 1)
    const pickedMap = maps[randomNum]
    return pickedMap
}

world.beforeEvents.itemUse.subscribe((event) => { //handles players queing into the game by using the join game item then parses data from the data string provided by the returned Map given by the function pickMap() to start a game.
    const item = event.itemStack.typeId
    if (item === "b_minigames:join_game_item") {
        event.source.addTag("Ready")
        const players = world.getPlayers({tags: "Ready"});
        if (players.length > 2 && world.getDynamicProperty("lobby_count_started") === false) {
            startLobbyCount();
            const map = pickMap();
            const parsedData = JSON.parse(map.mapData); 
            const name = map.name;
            const spawns = parsedData.spawns;
            const barriers = parsedData.barriers;
            const chests = parsedData.chests;
            const dimension = parsedData.dimension;
            const numOfTicks = parsedData.numOfPlayers;
            //start game here using data to perform relevant actions

        };
    }
})
