import { world, system } from "@minecraft/server";
import { takeItems } from "./map_making";
import { lobbySettingItem } from "./map_making";

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.itemStack?.typeId === "b_minigames:set_lobby_item") {
    if (!event.isFirstEvent) {return};
    if (!event.player.hasTag('settingLobby')) {return};
        const lobby = {location: event.block.location, dimension: event.block.dimension.id}
        system.run(() => {
            world.setDynamicProperty('lobby', JSON.stringify(lobby))
            world.sendMessage(`Lobby created with this data: ${JSON.stringify(lobby.location)}, ${JSON.stringify(lobby.dimension)}`)
            event.player.removeTag('settingLobby')
            takeItems(event.player, lobbySettingItem)
            const allPlayers = world.getAllPlayers()
            for (const singlePlayer of allPlayers) {
                singlePlayer.setSpawnPoint({x: lobby.location.x, y: lobby.location.y, z: lobby.location.z, dimension: event.block.dimension})
            }
        })
    }
})