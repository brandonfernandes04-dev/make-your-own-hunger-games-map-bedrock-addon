import { system, world } from "@minecraft/server"
import { Map } from "./map_making"
import "./start_game_logic"
import "./map_making"

system.run(() => {
    Map.loadAllMaps()
})

