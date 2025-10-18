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
