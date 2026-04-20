import {world, system } from "@minecraft/server"
import { Map } from "./map_making"

function startLobbyCount( players ) { // starts game count down and calls funtions to set everything up called from world.beforeEvents.itemUse.Subscribe (player que handler)
    world.setDynamicProperty("lobby_count_started", true)
    const Players = players
    let count = 31;
    system.runInterval(() => {
        count -- 
        Players.forEach(player => {
            player.onScreenDisplay.setActionBar(count)
        });
    }, 20);
    if (count < 1) {
        count = 31
        world.setDynamicProperty("lobby_count_started", false)
        return
    }
}
function pickMap(numOfPlayers) { //Returns an instance of a class from the static property allMaps in the class Map based on a random number
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

world.afterEvents.itemUse.subscribe((event) => { //handles players queing into the game by using the join game item
    const item = event.itemStack.typeId
    if (item === "b_minigames:join_game_item") {
        event.source.addTag("Ready")
    }
    else return;
})

world.afterEvents.itemUse.subscribe((event) => { //handles starting the game when any player uses the start game item and there is more than 1 player ready in the lobby.
    const item = event.itemStack.typeId
    if (item === "b_minigames:start_match_item") {
        const players = world.getPlayers({tags: "Ready"});
        if (players.length > 2 && world.getDynamicProperty("lobby_count_started") === false && world.getDynamicProperty("game_active") === false) {
            startLobbyCount(players);
            const map = pickMap(players.length);
            const parsedData = JSON.parse(map.mapData); 
            const dimension = parsedData.dimension;
            const name = map.name;
            world.sendMessage(`Next map: ${name}`) //Tells the players what map they will be playing next
            const barriers = parsedData.barriers;
            setBarriers(barriers, dimension) //need to write
            const chests = parsedData.chests;
            fillChests(chests, dimension) //need to write
            const spawns = parsedData.spawns;
            MovePlayers(spawns, dimension) //need to write
            const numOfTicks = parsedData.numOfTicks; //Create game timer using this data
        }
    }
})


