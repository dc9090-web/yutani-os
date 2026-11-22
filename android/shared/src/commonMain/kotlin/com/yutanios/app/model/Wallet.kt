package com.yutanios.app.model

import kotlinx.serialization.Serializable

/** The balance is its own resource, beside the two row lists `Paths.wallet` names. */
fun Paths.walletBalance(id: Long) = "/api/v1/characters/$id/wallet"

/** `GET /api/v1/characters/{id}/wallet`. */
@Serializable data class WalletSummary(val balance: String? = null, val balanceIsk: Double? = null)

/** `GET …/wallet?kind=…`: one page of journal entries or market transactions, newest first. */
@Serializable data class WalletRows<T>(val kind: String = "", val offset: Int = 0, val limit: Int = 0, val rows: List<T> = emptyList())

@Serializable
data class JournalRow(
    val id: Long, val date: String = "", val day: String = "", val time: String = "",
    val refType: String = "", val description: String = "", val withParty: String? = null,
    val signedAmount: String? = null, val balanceText: String? = null, val sign: String = "",
    val amount: String? = null, val balance: String? = null, val firstParty: String? = null, val secondParty: String? = null,
)

@Serializable
data class TransactionRow(
    val transactionId: Long, val date: String = "", val day: String = "", val time: String = "",
    val side: String = "", val typeId: Long = 0, val typeName: String = "", val quantity: String = "",
    val unitText: String = "", val signedTotal: String = "", val unitPrice: String = "", val total: String = "",
    val location: String = "", val system: SystemRef? = null,
)

/** How many rows of each list a sync keeps on the phone. A stored list this long may have older rows on the site. */
const val WALLET_STORED = 500

/** How many older rows one press of "Load older" asks the site for. */
const val WALLET_OLDER_PAGE = 100

/** Older rows fetched this session and held in memory only. `fetched` counts what the site sent, repeats included. */
data class Older<T>(val rows: List<T> = emptyList(), val fetched: Int = 0, val done: Boolean = false)

/** Only a full stored list can have more behind it, and a short page from the site ends it. */
fun hasOlder(storedCount: Int, older: Older<*>): Boolean = storedCount == WALLET_STORED && !older.done

/** The site's offset counts its own rows, so repeats dropped here still move it on. */
fun nextOffset(storedCount: Int, older: Older<*>): Int = storedCount + older.fetched

/**
 * Adds a fetched page. New rows arriving on the site since the last sync push everything down, so a
 * page can repeat rows the phone already shows; those are dropped by id.
 */
fun <T> Older<T>.plusPage(stored: List<T>, page: List<T>, id: (T) -> Long): Older<T> {
    val seen = (stored + rows).mapTo(HashSet()) { id(it) }
    return Older(rows + page.filter { seen.add(id(it)) }, fetched + page.size, page.size < WALLET_OLDER_PAGE)
}

/** What a wallet list draws, in order: a day header, then that day's rows. */
sealed interface WalletEntry<out T> {
    data class Day(val day: String, val count: Int) : WalletEntry<Nothing>
    data class Line<T>(val row: T) : WalletEntry<T>
}

/** The site's `byDay`, flattened: consecutive rows of one UTC day share a header carrying their count. */
fun <T> walletEntries(rows: List<T>, day: (T) -> String): List<WalletEntry<T>> {
    val out = ArrayList<WalletEntry<T>>(rows.size + 8)
    var start = 0
    while (start < rows.size) {
        var end = start
        while (end < rows.size && day(rows[end]) == day(rows[start])) end++
        out += WalletEntry.Day(day(rows[start]), end - start)
        for (i in start until end) out += WalletEntry.Line(rows[i])
        start = end
    }
    return out
}

/** The line under a list: the site's `Foot` note. */
fun footNote(shown: Int, more: Boolean, one: String, many: String): String {
    val noun = if (shown == 1) one else many
    return if (more) "Showing the latest $shown $noun" else "All $shown $noun"
}
