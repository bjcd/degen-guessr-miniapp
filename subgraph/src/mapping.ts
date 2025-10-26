import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Win } from "../generated/DegenGuessr/DegenGuessr"
import { SpinResult as SpinResultEvent } from "../generated/DegenSlot/DegenSlot"
import { Win as WinEntity, GameStats, SpinResult, SlotPlayerStats, SlotGameStats } from "../generated/schema"

export function handleWin(event: Win): void {
    // Create unique ID from transaction hash and log index
    let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()

    // Create Win entity
    let win = new WinEntity(id)
    win.tx = event.transaction.hash
    win.block = event.block.number
    win.timestamp = event.block.timestamp
    win.player = event.params.player
    win.guessedNumber = event.params.guessedNumber
    win.winningNumber = event.params.winningNumber
    win.amount = event.params.amount
    win.contractAddress = event.address
    // Simple mode tag based on contract address
    let addr = event.address.toHexString().toLowerCase()
    if (addr == "0x743c74d3b77e3576d39aa00c5435d1931e0daad7") {
        win.mode = "degen"
    } else if (addr == "0x697139fa21c69393b5359b4075f99ad1eafa0297") {
        win.mode = "super"
    } else {
        win.mode = "unknown"
    }
    win.save()

    // Update game stats
    let statsId = "game-stats"
    let stats = GameStats.load(statsId)
    if (stats == null) {
        stats = new GameStats(statsId)
        stats.totalWins = 0
        stats.totalPot = BigInt.fromI32(0)
    }

    stats.totalWins = stats.totalWins + 1
    stats.totalPot = stats.totalPot.plus(event.params.amount)
    stats.lastUpdated = event.block.timestamp
    stats.save()
}

export function handleSpinResult(event: SpinResultEvent): void {
    // Create unique ID from transaction hash and log index
    let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()

    // Create SpinResult entity
    let spinResult = new SpinResult(id)
    spinResult.tx = event.transaction.hash
    spinResult.block = event.block.number
    spinResult.timestamp = event.block.timestamp
    spinResult.player = event.params.player
    spinResult.roll = event.params.roll
    spinResult.category = event.params.category
    spinResult.payout = event.params.payout
    spinResult.potAfter = event.params.potAfter
    spinResult.save()

    // Update player stats
    let playerId = event.params.player.toHexString()
    let playerStats = SlotPlayerStats.load(playerId)
    if (playerStats == null) {
        playerStats = new SlotPlayerStats(playerId)
        playerStats.address = event.params.player
        playerStats.totalSpins = 0
        playerStats.totalWinnings = BigInt.fromI32(0)
    }

    playerStats.totalSpins = playerStats.totalSpins + 1
    playerStats.totalWinnings = playerStats.totalWinnings.plus(event.params.payout)
    playerStats.lastUpdated = event.block.timestamp
    playerStats.save()

    // Update slot game stats
    let slotStatsId = "slot-game-stats"
    let slotStats = SlotGameStats.load(slotStatsId)
    if (slotStats == null) {
        slotStats = new SlotGameStats(slotStatsId)
        slotStats.totalSpins = 0
        slotStats.totalPot = BigInt.fromI32(0)
    }

    slotStats.totalSpins = slotStats.totalSpins + 1
    slotStats.totalPot = event.params.potAfter
    slotStats.lastUpdated = event.block.timestamp
    slotStats.save()
}
