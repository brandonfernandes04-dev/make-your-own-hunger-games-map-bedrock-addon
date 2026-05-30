import { world, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

let multiplier


world.beforeEvents.itemUse.subscribe((event) => {
    system.run(() => {
        const item = event.itemStack
        if (item.typeId !== "b_minigames:barrier_tool") {return};
        const player = event.source
        if (!player.isSneaking) {return};
        
        const modes = ['off', 'y+',  'y-', 'x+', 'x-', 'z+', 'z-']
        const barrierToolConfig = new ModalFormData()
            .title('Barrier tool settings')
            .dropdown('Modes', modes, {defaultValueIndex: 0, tooltip: 'Sets the direction barriers will be built in'})
            .slider('Barrier tool ticks per cycle', 1, 10, {defaultValue: 1, tooltip: 'Sets the number of ticks which must occur before a barrier is placed by the tool. At max value a barrier is placed every 10 ticks which is roughly 2 block a second. At the lowest value a barrier is placed every 1 tick which is roughly 20 blocks a second.'})
            .submitButton('Submit');
        
        barrierToolConfig.show(player).then(response => {
            if (response.canceled) {return};
            const mode = response.formValues[0]
            if (mode === 0) {
                player.onScreenDisplay.setActionBar('Barrier Tool is now off')
                player.setDynamicProperty('barrierToolDirection') 
            }
            else {
                player.onScreenDisplay.setActionBar(`Barrier tool set to ${modes[mode]}`)
                player.setDynamicProperty('barrierToolDirection', modes[mode])
                multiplier = response.formValues[1] / 10
            }
            player.playSound("barrierToolChangeMode", {volume: 12})
        })
    })
})



// const currentDirection = player.getDynamicProperty('barrierToolDirection')
// if (!currentDirection) {player.setDynamicProperty('barrierToolDirection', 'off')}
// switch (currentDirection) {
//     case 'off':
//         player.setDynamicProperty('barrierToolDirection', 'y+')
//         player.onScreenDisplay.setActionBar('Barrier Tool will increase along the y axis')
//     break;

//     case 'y+':
//         player.setDynamicProperty('barrierToolDirection', 'y-')
//         player.onScreenDisplay.setActionBar('Barrier Tool will decrease along the y axis')
//     break;

//     case 'y-':
//         player.setDynamicProperty('barrierToolDirection', 'x+')
//         player.onScreenDisplay.setActionBar('Barrier Tool will increase along the x axis')
//     break;

//     case 'x+':
//         player.setDynamicProperty('barrierToolDirection', 'x-')
//         player.onScreenDisplay.setActionBar('Barrier Tool will decrease along the x axis')
//     break;

//     case 'x-':
//         player.setDynamicProperty('barrierToolDirection', 'z+')
//         player.onScreenDisplay.setActionBar('Barrier Tool will increase along the z axis')
//     break;

//     case 'z+':
//         player.setDynamicProperty('barrierToolDirection', 'z-')
//         player.onScreenDisplay.setActionBar('Barrier Tool will decrease along the z axis')
//     break;

//     case 'z-':
//         player.setDynamicProperty('barrierToolDirection')
//         player.onScreenDisplay.setActionBar('Barrier Tool is now off')
//     break;
// }
// player.playSound("barrierToolCycle", {volume: 12})

let blockUsedOnLocation
let lastUseTime
let useCount = 0
let baseCount = 10

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    system.run(() => {
        const item = event.itemStack
        if (!item) {return};
        if (item.typeId !== "b_minigames:barrier_tool") {return};
        const player = event.player
        if (player.isSneaking) {return};
        if (!multiplier) {return player.sendMessage('Must set multiplier')}
        if (system.currentTick - lastUseTime <= baseCount * multiplier) {return};
        const block = event.block
        const dimension = block.dimension
        if (!blockUsedOnLocation || block.location.x === blockUsedOnLocation.x && block.location.y === blockUsedOnLocation.y && block.location.z === blockUsedOnLocation.z) {
                const direction = player.getDynamicProperty('barrierToolDirection')
                switch(direction) {
                    case 'y+':
                        const above = block.above(useCount)
                    if (useCount === 0 || above.typeId === 'minecraft:air') {
                        dimension.setBlockType(above.location, 'minecraft:barrier')
                        player.onScreenDisplay.setActionBar(`Barriers Placed: ${useCount + 1}`)
                    }
                    else {
                        player.sendMessage(`Stopped to avoid hittng ${above.typeId}`)
                        player.playSound("barrierToolFail", {volume: 12})
                        return useCount = 0
                    }
                    break;
                    
                    case 'y-':
                        const below = block.below(useCount)
                        if (useCount === 0 || below.typeId === 'minecraft:air') {
                            dimension.setBlockType(below.location, 'minecraft:barrier')
                            player.onScreenDisplay.setActionBar(`Barriers Placed: ${useCount + 1}`)
                        }
                        else {
                            player.sendMessage(`Stopped to avoid hittng ${below.typeId}`)
                            player.playSound("barrierToolFail", {volume: 12})
                            return useCount = 0
                        }
                    break;
        
                    case 'x+':
                        const east = block.east(useCount)
                        if (useCount === 0 || east.typeId === 'minecraft:air') {
                            dimension.setBlockType(east.location, 'minecraft:barrier')
                            player.onScreenDisplay.setActionBar(`Barriers Placed: ${useCount + 1}`)
                        }
                        else {
                            player.sendMessage(`Stopped to avoid hittng ${east.typeId}`)
                            player.playSound("barrierToolFail", {volume: 12})
                            return useCount = 0
                        }
                    break;
        
                    case 'x-':
                        const west = block.west(useCount)
                        if (useCount === 0 || west.typeId === 'minecraft:air') {
                            dimension.setBlockType(west.location, 'minecraft:barrier')
                            player.onScreenDisplay.setActionBar(`Barriers Placed: ${useCount + 1}`)
                        }
                        else {
                            player.sendMessage(`Stopped to avoid hittng ${west.typeId}`)
                            player.playSound("barrierToolFail", {volume: 12})
                            return useCount = 0
                        }
                    break;
        
                    case 'z+':
                        const south = block.south(useCount)
                        if (useCount === 0 || south.typeId === 'minecraft:air') {
                            dimension.setBlockType(south.location, 'minecraft:barrier')
                            player.onScreenDisplay.setActionBar(`Barriers Placed: ${useCount + 1}`)
                        }
                        else {
                            player.sendMessage(`Stopped to avoid hittng ${south.typeId}`)
                            player.playSound("barrierToolFail", {volume: 12})
                            return useCount = 0
                        }
                    break;
        
                    case 'z-':
                        const north = block.north(useCount)
                        if (useCount === 0 || north.typeId === 'minecraft:air') {
                            dimension.setBlockType(north.location, 'minecraft:barrier')
                            player.onScreenDisplay.setActionBar(`Barriers Placed: ${useCount + 1}`)
                        }
                        else {
                            player.sendMessage(`Stopped to avoid hittng ${north.typeId}`)
                            player.playSound("barrierToolFail", {volume: 12})
                            return useCount = 0
                        }
                    break;
        
                    default: player.sendMessage('The barrier tool is off to set its direction and turn it on crouch click'); player.playSound("barrierToolFail", {volume: 12});
                    break;
                }
            lastUseTime = system.currentTick
            blockUsedOnLocation = block.location
            useCount ++
        }
        else {
            lastUseTime = system.currentTick
            blockUsedOnLocation = block.location
            useCount = 0
        }
    })
})