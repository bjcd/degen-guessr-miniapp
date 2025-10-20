import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Win } from "../generated/DegenGuessr/DegenGuessr"
import { Win as WinEntity, GameStats } from "../generated/schema"

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
