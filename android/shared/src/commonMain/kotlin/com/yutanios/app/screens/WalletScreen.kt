package com.yutanios.app.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yutanios.app.model.JournalRow
import com.yutanios.app.model.Paths
import com.yutanios.app.model.TransactionRow
import com.yutanios.app.model.WalletEntry
import com.yutanios.app.model.WalletRows
import com.yutanios.app.model.WalletSummary
import com.yutanios.app.model.footNote
import com.yutanios.app.model.walletBalance
import com.yutanios.app.ui.Btn
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.Res
import com.yutanios.app.ui.Screen
import com.yutanios.app.ui.Tabs
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.resource
import com.yutanios.app.ui.type
import com.yutanios.app.ui.whenMissing

/** The balance, then the Journal and Transactions tabs: each a day-grouped list of the rows kept on the phone. */
@Composable
fun WalletScreen(characterId: Long, initialTab: Int = 0) {
    // Read here, not inside the list builder: the builder can run again between a state change and
    // this function's recomposition, and would then pair a new state with the rows worked out from the old one.
    val summary = resource(Paths.walletBalance(characterId), WalletSummary.serializer()).value
    val journalState = resource(Paths.wallet(characterId, "journal"), WalletRows.serializer(JournalRow.serializer())).value
    val tradeState = resource(Paths.wallet(characterId, "transactions"), WalletRows.serializer(TransactionRow.serializer())).value
    var tab by remember { mutableIntStateOf(initialTab) }
    val journal = rememberPaged(characterId, "journal", journalState, JournalRow.serializer(), { it.id }, { it.day })
    val trades = rememberPaged(characterId, "transactions", tradeState, TransactionRow.serializer(), { it.transactionId }, { it.day })
    Screen("Wallet") {
        if (whenMissing(summary)) return@Screen
        val balance = (summary as Res.Ready).data.balance
        item(key = "balance") {
            Column(Modifier.padding(bottom = 20.dp)) {
                Label("Balance")
                if (balance == null) Txt("Not synced yet", type.body, Modifier.padding(top = 8.dp), Yo.textMuted)
                else Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.Bottom) {
                    // `.wt-balance-figure` is 26px on a phone, larger than the stat strip's figure.
                    Txt(balance, type.figure.copy(fontSize = 26.sp), Modifier.weight(1f, fill = false), maxLines = 1)
                    Txt(" ISK", type.meta, Modifier.padding(bottom = 4.dp), maxLines = 1)
                }
            }
        }
        item(key = "tabs") { Tabs(listOf("Journal", "Transactions"), tab, { tab = it }, Modifier.padding(bottom = 20.dp)) }
        if (tab == 0) {
            walletList(journalState, journal, "journal", { if (it == 1) "1 entry" else "$it entries" }, "journal entry", "journal entries") { JournalLine(it) }
        } else {
            walletList(tradeState, trades, "transactions", { if (it == 1) "1 transaction" else "$it transactions" }, "market transaction", "market transactions") { TransactionLine(it) }
        }
    }
}

/** One tab's list: a card of day headers and rows as separate lazy items, then the note and "Load older". */
private fun <T> LazyListScope.walletList(
    state: Res<*>, paged: Paged<T>, kind: String, dayCount: (Int) -> String, one: String, many: String,
    line: @Composable (T) -> Unit,
) {
    if (whenMissing(state)) return
    val entries = paged.entries
    if (entries.isEmpty()) {
        item(key = "$kind-none") { Empty("Not synced yet — the wallet job runs hourly.") }
        return
    }
    items(
        entries.size,
        key = { i -> when (val e = entries[i]) { is WalletEntry.Day -> "$kind-day-${e.day}-$i"; is WalletEntry.Line -> "$kind-${paged.id(e.row)}" } },
        contentType = { entries[it] is WalletEntry.Day },
    ) { i ->
        Column(Modifier.cardSegment(first = i == 0, last = i == entries.lastIndex)) {
            when (val e = entries[i]) {
                is WalletEntry.Day -> DayHead(e.day, dayCount(e.count))
                is WalletEntry.Line -> line(e.row)
            }
        }
    }
    item(key = "$kind-foot") {
        Column(Modifier.fillMaxWidth().padding(top = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Txt(footNote(paged.shown, paged.more, one, many), type.meta, Modifier.weight(1f).padding(end = 12.dp))
                if (paged.more) Btn(if (paged.busy) "Loading…" else "Load older", paged.load, enabled = !paged.busy)
            }
            if (paged.failed) Txt("Older entries need a connection to the site.", type.meta, Modifier.padding(top = 10.dp), Yo.bad)
        }
    }
}
