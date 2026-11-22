package com.yutanios.app.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.QueueEntry
import com.yutanios.app.model.SheetGroup
import com.yutanios.app.model.SheetSkill
import com.yutanios.app.model.SkillsData
import com.yutanios.app.model.TrainingData
import com.yutanios.app.model.TrainingOverviewCharacter
import com.yutanios.app.time.countdown
import com.yutanios.app.time.epochMs
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.EveImage
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.LevelBlocks
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.SegBar
import com.yutanios.app.ui.Tag
import com.yutanios.app.ui.TagTone
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.rememberNow
import com.yutanios.app.ui.type
import kotlin.math.roundToInt

private fun plural(count: Int, word: String) = "$count $word${if (count == 1) "" else "s"}"

// ---------- Overview: every chosen character's queue ----------

internal fun LazyListScope.overviewTab(characters: List<TrainingOverviewCharacter>) {
    item(key = "tq-legend") { BlockLegend(); Gap(16.dp) }
    items(characters.size, key = { "tq-${characters[it].id}" }) { i ->
        QueueCard(characters[i])
        Gap(16.dp)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QueueCard(view: TrainingOverviewCharacter) {
    val percent = view.progress?.let { (it * 100).roundToInt() }
    val more = view.count - view.rows.size
    Card {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Tile(EveImage.portrait(view.id, 128), 44.dp, description = null, radius = 6.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                    Txt(view.name, type.h2, maxLines = 1)
                    if (view.online == true) Tag("Online", TagTone.Good)
                }
                when (view.status.kind) {
                    "eta" -> Row(verticalAlignment = Alignment.CenterVertically) {
                        Txt("Done in ", type.meta)
                        Txt(view.status.text.orEmpty(), type.mono)
                    }
                    "paused" -> Txt("Paused", type.meta, color = Yo.bad)
                    "notSynced" -> Txt("Not synced", type.meta)
                    else -> Txt("Queue empty", type.meta)
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Label("In queue")
                Txt(view.count.toString(), type.figure)
            }
        }
        if (percent != null) {
            Gap(14.dp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Label("Current skill")
                SegBar((view.progress ?: 0.0).toFloat(), Modifier.weight(1f), Yo.accent)
                Percent(percent)
            }
        }
        Gap(14.dp)
        if (view.rows.isEmpty()) {
            Empty(if (view.status.kind == "notSynced") "Skills not synced yet" else "No skills in queue")
        } else {
            RowLine(color = Yo.border)
            view.rows.forEach { row ->
                Row(Modifier.fillMaxWidth().heightIn(min = 36.dp).padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Txt(row.position.toString(), type.mono, Modifier.width(26.dp), Yo.textLabel)
                    QueueBlocks(row.targetLevel, row.training)
                    Txt(row.skill, type.body, Modifier.weight(1f).padding(start = 14.dp, end = 10.dp), maxLines = 2)
                    Txt(row.remaining, type.mono, color = Yo.textMuted, maxLines = 1)
                }
                RowLine()
            }
        }
        if (more > 0) {
            Gap(14.dp)
            Txt("+$more more in queue", type.mono, color = Yo.textLabel)
        }
    }
}

// ---------- Skills: the sheet, a card per group ----------

internal fun LazyListScope.sheetTab(sheet: SkillsData, open: String?, onToggle: (String) -> Unit) {
    if (sheet.groups.isEmpty()) {
        item(key = "sheet-empty") { Empty("Not synced yet — the skills job runs hourly.") }
        return
    }
    item(key = "sheet-legend") {
        BlockLegend(untrained = true, end = "${plural(sheet.queueLength, "level")} in queue")
        Gap(16.dp)
    }
    sheet.groups.forEach { group ->
        item(key = "group-${group.groupId}") { GroupHead(group) }
        items(group.skills.size, key = { "skill-${group.groupId}-${group.skills[it].skillId}" }) { i ->
            val key = "skill-${group.skills[i].skillId}"
            SkillRow(group.skills[i], open == key) { onToggle(key) }
        }
        item(key = "group-end-${group.groupId}") {
            Box(Modifier.cardPart(last = true).height(16.dp))
            Gap(16.dp)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GroupHead(group: SheetGroup) {
    Column(Modifier.cardPart(first = true).padding(top = 16.dp)) {
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Txt(group.name, type.h2, Modifier.alignByBaseline().padding(end = 16.dp))
            Row(Modifier.alignByBaseline()) {
                Txt("${plural(group.skills.size, "skill")} · ${group.groupSp} SP", type.mono, color = Yo.textMuted, maxLines = 1)
                if (group.queued > 0) Txt(" · ${plural(group.queued, "level")} queued", type.mono, color = Yo.accent, maxLines = 1)
            }
        }
        Gap(14.dp)
        RowLine(color = Yo.border)
    }
}

@Composable
private fun SkillRow(skill: SheetSkill, open: Boolean, onToggle: () -> Unit) {
    val desc = skill.desc
    Column(Modifier.cardPart()) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 36.dp).then(if (desc == null) Modifier else Modifier.clickable(role = Role.Button, onClickLabel = "Description", onClick = onToggle)),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            LevelBlocks(skill.level, queuedTo = skill.level + skill.queued, training = if (skill.training) skill.level + 1 else 0)
            // Untrained and not queued: dimmed, as `.sk-name.is-untrained`.
            Txt(skill.name, type.body, Modifier.weight(1f, fill = false), if (skill.level == 0 && skill.queued == 0) Yo.textLabel else Yo.text, maxLines = 1)
            if (desc != null) InfoGlyph(open)
            if (skill.activeLevel < skill.level) Flag("ACTIVE ${skill.activeLevel}", Yo.textLabel)
            if (skill.training) Flag("TRAINING")
        }
        if (open && desc != null) InfoPanel(desc)
        RowLine()
    }
}

// ---------- Training: the active character's queue ----------

internal fun LazyListScope.trainingTab(training: TrainingData, open: String?, onToggle: (String) -> Unit) {
    val entries = training.entries
    item(key = "queue-head") { QueueHead(entries.size, epochMs(training.finishAt)) }
    items(entries.size, key = { "queue-$it" }) { i ->
        val key = "queue-$i"
        QueueRow(entries[i], open == key) { onToggle(key) }
    }
    if (entries.isNotEmpty()) item(key = "queue-end") { Box(Modifier.cardPart(last = true).height(16.dp)) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QueueHead(count: Int, finishAt: Long?) {
    Column(Modifier.cardPart(first = true, last = count == 0).padding(top = 16.dp)) {
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Txt("Training queue", type.h2, Modifier.alignByBaseline().padding(end = 16.dp))
            if (count > 0) Row(Modifier.alignByBaseline()) {
                Txt("${plural(count, "skill")} · all trained in ", type.meta, maxLines = 1)
                QueueCountdown(finishAt)
            }
        }
        Gap(16.dp)
        BlockLegend()
        if (count == 0) {
            Empty("Nothing in the training queue.")
        } else {
            Gap(16.dp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Label("#", Modifier.width(38.dp))
                Label("Level", Modifier.width(86.dp))
                Label("Skill")
            }
            Gap(8.dp)
            RowLine(color = Yo.border)
        }
    }
}

/** The one line on the screen that ticks every second: the time until the whole queue is trained. */
@Composable
private fun QueueCountdown(finishAt: Long?) {
    val now = rememberNow(1000).value
    Txt(if (finishAt == null) "—" else countdown(finishAt - now), type.mono, maxLines = 1)
}

@Composable
private fun QueueRow(entry: QueueEntry, open: Boolean, onToggle: () -> Unit) {
    val desc = entry.desc
    val progress = entry.progress
    Column(Modifier.cardPart()) {
        Column(
            Modifier.fillMaxWidth().then(if (desc == null) Modifier else Modifier.clickable(role = Role.Button, onClickLabel = "Description", onClick = onToggle))
                .padding(vertical = 4.dp),
        ) {
            Row(Modifier.heightIn(min = 28.dp), verticalAlignment = Alignment.CenterVertically) {
                Txt(entry.position.toString(), type.mono, Modifier.width(38.dp), Yo.textLabel, maxLines = 1)
                Box(Modifier.width(86.dp)) { QueueBlocks(entry.targetLevel, training = progress != null) }
                Txt(entry.skill, type.body, Modifier.weight(1f), maxLines = 2)
                if (desc != null) InfoGlyph(open)
            }
            // On a phone the site drops the tag, bar and time to a second line under the name.
            Row(Modifier.fillMaxWidth().padding(start = 38.dp, top = 2.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                if (progress != null) {
                    Flag("TRAINING")
                    SegBar(progress.toFloat(), Modifier.padding(start = 10.dp).width(96.dp), Yo.accent)
                    Percent((progress * 100).roundToInt())
                }
                Spacer(Modifier.weight(1f))
                Txt(entry.remaining, type.mono, color = Yo.textMuted, maxLines = 1)
            }
        }
        if (open && desc != null) InfoPanel(desc)
        RowLine()
    }
}
