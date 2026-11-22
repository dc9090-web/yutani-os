package com.yutanios.app.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.Overview
import com.yutanios.app.model.OverviewCard
import com.yutanios.app.model.Paths
import com.yutanios.app.model.TrainingNow
import com.yutanios.app.model.trainingNow
import com.yutanios.app.time.duration
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.EveImage
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.Place
import com.yutanios.app.ui.Res
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Screen
import com.yutanios.app.ui.SegBar
import com.yutanios.app.ui.Stat
import com.yutanios.app.ui.StatStrip
import com.yutanios.app.ui.Tag
import com.yutanios.app.ui.TagTone
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.rememberNow
import com.yutanios.app.ui.resource
import com.yutanios.app.ui.type
import com.yutanios.app.ui.whenMissing

/** Every character on one screen: the summary strip, then a card each. */
@Composable
fun OverviewScreen() {
    val state = resource(Paths.OVERVIEW, Overview.serializer()).value
    val now = rememberNow().value
    Screen("Overview", perCharacter = false) {
        if (whenMissing(state)) return@Screen
        val overview = (state as Res.Ready).data
        // Which queues are running, and which skill lands next, depend on the time: worked out here, now.
        val training = overview.cards.map { trainingNow(it.trainingRaw.queue, it.trainingRaw.synced, now) }
        val running = overview.cards.zip(training).mapNotNull { (card, t) -> (t as? TrainingNow.Active)?.finish?.let { card to it } }
        val next = running.minByOrNull { it.second }
        item(key = "summary") {
            StatStrip(listOf(
                Stat("Combined wallet", overview.summary.wallet, "ISK"),
                Stat("Total skill points", overview.summary.totalSp, "SP"),
                Stat("Training queues", "${running.size} of ${overview.summary.queuesTotal}", note = "active"),
                Stat("Next skill in", next?.let { duration(it.second - now) } ?: "—", note = next?.first?.name),
            ))
            Gap(20.dp)
        }
        items(overview.cards.size, key = { overview.cards[it].id }) { i ->
            CharacterCard(overview.cards[i], training[i])
            Gap(16.dp)
        }
    }
}

@Composable
private fun CharacterCard(card: OverviewCard, training: TrainingNow) {
    Card {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Tile(EveImage.portrait(card.id, 128), 52.dp, description = null, radius = 6.dp)
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Txt(card.name, type.h2, Modifier.weight(1f, fill = false), maxLines = 1)
                    card.accountTag?.let { Tag(it, if (it == "MAIN") TagTone.Main else TagTone.Outline) }
                }
                Txt(listOfNotNull(card.corp, card.race).joinToString(" · "), type.meta, Modifier.padding(top = 2.dp), maxLines = 2)
            }
        }
        if (card.needsReauth) Txt("Needs re-authorising on the site: its data has stopped updating.", type.meta, Modifier.padding(top = 10.dp), Yo.bad)
        if (card.tags.isNotEmpty()) Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) { card.tags.forEach { Tag(it) } }
        Gap(14.dp); RowLine()
        Fact("Total SP") { Txt(card.totalSp ?: "—", type.mono) }
        Fact("Wallet") { Txt(card.balance?.let { "$it ISK" } ?: "—", type.mono) }
        Fact("Ship") {
            Column(horizontalAlignment = Alignment.End) {
                Txt(card.ship?.typeName ?: "—", type.body, maxLines = 1)
                card.ship?.groupName?.let { Txt(it, type.meta, maxLines = 1) }
            }
        }
        Fact("Location") {
            Column(horizontalAlignment = Alignment.End) {
                val system = card.system
                if (system == null) Txt("—", type.body) else Place(system.name, system.sec, system.secClass, style = type.body)
                card.dockedAt?.let { Txt(it, type.meta, maxLines = 2, align = TextAlign.End) }
                if (card.online == true) Txt("Online", type.meta, color = Yo.good)
            }
        }
        Gap(12.dp)
        Label("Training")
        Gap(6.dp)
        when (training) {
            is TrainingNow.Idle -> Txt(training.label, type.meta)
            is TrainingNow.Active -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Txt(training.skill, type.bodyStrong, Modifier.weight(1f), maxLines = 1)
                    Txt(training.time, type.mono, color = Yo.accent)
                }
                Gap(8.dp)
                SegBar(training.percent / 100f, color = Yo.accent)
            }
        }
    }
}

/** One labelled row of a card: the micro label at the left, the value at the right. */
@Composable
private fun Fact(label: String, value: @Composable () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.Top) {
        Label(label, Modifier.padding(top = 2.dp))
        Row(Modifier.weight(1f).padding(start = 16.dp), horizontalArrangement = Arrangement.End) { value() }
    }
    RowLine()
}
