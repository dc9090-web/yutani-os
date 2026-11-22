package com.yutanios.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.JournalRow
import com.yutanios.app.model.Older
import com.yutanios.app.model.Paths
import com.yutanios.app.model.TransactionRow
import com.yutanios.app.model.WALLET_OLDER_PAGE
import com.yutanios.app.model.WalletEntry
import com.yutanios.app.model.WalletRows
import com.yutanios.app.model.hasOlder
import com.yutanios.app.model.nextOffset
import com.yutanios.app.model.plusPage
import com.yutanios.app.model.walletEntries
import com.yutanios.app.ui.EveImage
import com.yutanios.app.ui.LocalApp
import com.yutanios.app.ui.Place
import com.yutanios.app.ui.Res
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Tag
import com.yutanios.app.ui.TagTone
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.type
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.KSerializer

private const val DASH = "—"

/** One wallet list as its tab draws it: the stored rows plus any older ones fetched this session. */
internal class Paged<T>(
    val entries: List<WalletEntry<T>>, val shown: Int, val id: (T) -> Long,
    val more: Boolean, val busy: Boolean, val failed: Boolean, val load: () -> Unit,
)

/**
 * Older rows are the one thing this screen asks the site for, and only on the button. They live in
 * memory and are dropped when a sync rewrites the stored list, because its offsets have then moved.
 */
@Composable
internal fun <T> rememberPaged(
    characterId: Long, kind: String, state: Res<WalletRows<T>>, serializer: KSerializer<T>, id: (T) -> Long, day: (T) -> String,
): Paged<T> {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val loaded = (state as? Res.Ready)?.loaded
    val stored = loaded?.data?.rows ?: emptyList()
    var older by remember(characterId, loaded?.generatedAt, loaded?.fetchedAt) { mutableStateOf(Older<T>()) }
    var busy by remember(characterId, loaded?.generatedAt, loaded?.fetchedAt) { mutableStateOf(false) }
    var failed by remember(characterId, loaded?.generatedAt, loaded?.fetchedAt) { mutableStateOf(false) }
    val entries = remember(stored, older) { walletEntries(stored + older.rows, day) }
    val load: () -> Unit = {
        busy = true
        failed = false
        scope.launch {
            try {
                val path = Paths.wallet(characterId, kind, offset = nextOffset(stored.size, older), limit = WALLET_OLDER_PAGE)
                val page = app.repo.fetchOnce(path, WalletRows.serializer(serializer))
                older = older.plusPage(stored, page.rows, id)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failed = true
            } finally {
                busy = false
            }
        }
    }
    return Paged(entries, stored.size + older.rows.size, id, hasOlder(stored.size, older), busy, failed, load)
}

/** `.wt-day`: the UTC day in mono on a sunken band, with how many rows it holds. */
@Composable
internal fun DayHead(day: String, count: String) {
    Row(
        Modifier.fillMaxWidth().background(Yo.surfaceSunken).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Txt(day, type.mono.copy(fontWeight = FontWeight.Medium), maxLines = 1)
        Txt(count, type.meta, maxLines = 1)
    }
    RowLine(color = Yo.border)
}

private fun tone(sign: String): Color = when (sign) { "pos" -> Yo.good; "neg" -> Yo.bad; else -> Yo.text }

/** A journal row on a phone: time, type and the signed amount; beneath, who it was with and the balance after. */
@Composable
internal fun JournalLine(row: JournalRow) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Txt(row.time, type.mono, Modifier.width(64.dp), Yo.textMuted, maxLines = 1)
            Txt(row.refType, type.body, Modifier.weight(1f).padding(end = 12.dp), maxLines = 2)
            Txt(row.signedAmount ?: DASH, type.mono, color = tone(row.sign), maxLines = 1)
        }
        Row(Modifier.padding(start = 64.dp), verticalAlignment = Alignment.CenterVertically) {
            Txt(row.withParty ?: DASH, type.meta, Modifier.weight(1f).padding(end = 12.dp), maxLines = 1)
            Txt(row.balanceText ?: DASH, type.mono, color = Yo.textLabel, maxLines = 1)
        }
    }
    RowLine()
}

/** A transaction row on a phone: time and item; the BUY/SELL tag, quantity × unit price and the signed total; where. */
@Composable
internal fun TransactionLine(row: TransactionRow) {
    // A purchase is money out; the sign on the total says so too.
    val buy = row.side == "Buy"
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Txt(row.time, type.mono, Modifier.width(64.dp), Yo.textMuted, maxLines = 1)
            Tile(EveImage.icon(row.typeId, 64), 30.dp)
            Txt(row.typeName, type.body, Modifier.weight(1f).padding(start = 10.dp), maxLines = 1)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Tag(row.side, if (buy) TagTone.Bad else TagTone.Good)
            Txt("${row.quantity} × ${row.unitText}", type.mono, Modifier.weight(1f), Yo.textMuted, maxLines = 1)
            Txt(row.signedTotal, type.mono, color = if (buy) Yo.bad else Yo.good, maxLines = 1)
        }
        Place(row.location, row.system?.sec, row.system?.secClass)
    }
    RowLine()
}
