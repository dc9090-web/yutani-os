package com.yutanios.app.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.FitSheet
import com.yutanios.app.model.KeyFigure
import com.yutanios.app.model.OffenseNow
import com.yutanios.app.model.SheetLocation
import com.yutanios.app.model.dpsText
import com.yutanios.app.ui.EveImage
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.LevelBlocks
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Tag
import com.yutanios.app.ui.TagTone
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.secColor
import com.yutanios.app.ui.type

/** "0.9 Jita · Jita IV - Moon 4 - …": the security status in its colour, the system, the place, any note. */
@Composable
private fun locationLine(location: SheetLocation): AnnotatedString {
    val mono = type.mono.toSpanStyle()
    return buildAnnotatedString {
        val system = location.system
        if (system != null) {
            if (system.sec != null) withStyle(mono.copy(color = secColor(system.secClass))) { append(system.sec + " ") }
            withStyle(SpanStyle(fontWeight = FontWeight.Medium, color = Yo.text)) { append(system.name) }
        }
        location.place?.let { append(if (system == null) it else " · $it") }
        location.note?.let { append(if (system == null && location.place == null) it else " · $it") }
    }
}

/**
 * `.sd-summary`: the hull's render, what it is and where, then its value and the two status flags.
 * The hull's name is the page title above, so the card carries the fit's own name.
 */
@OptIn(ExperimentalLayoutApi::class)
internal fun LazyListScope.summary(view: FitSheet) {
    card("summary") {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Tile(EveImage.render(view.typeId, 128), 72.dp, radius = 8.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val kind = listOfNotNull(view.ship.groupName, view.ship.raceName).joinToString(" · ")
                if (kind.isNotEmpty()) Label(kind)
                if (view.title != view.typeName) Txt(view.title, type.h2.copy(color = Yo.text2))
                val location = locationLine(view.location)
                if (location.isNotEmpty()) Rich(location, type.meta)
                Mastery(view.mastery, Modifier.padding(top = 4.dp), suffix = " of V")
            }
        }
        Gap(16.dp)
        RowLine(color = Yo.border)
        Gap(14.dp)
        Label("Estimated value")
        Gap(10.dp)
        FigureUnit(view.value.totalShort.removeSuffix(" ISK"), "ISK", type.value24, unitSize = 12f)
        FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Flag(if (view.problems.isEmpty()) "Fit is legal" else plural(view.problems.size, "problem"), good = view.problems.isEmpty())
            Flag(if (view.missing.isEmpty()) "All skills trained" else plural(view.missing.size, "missing skill"), good = view.missing.isEmpty())
        }
    }
    if (!view.skillsSynced) item(key = "banner") {
        Banner("No skills synced yet — every skill is treated as level 0, so these numbers are worst case.")
        Gap(CardGap)
    }
}

/** `.sd-keys`: six figures, two across. DPS follows the drone selection; the rest are the site's strings. */
internal fun LazyListScope.keyFigures(view: FitSheet, offense: OffenseNow) {
    item(key = "keys") {
        val keys = listOf("EHP" to view.key.ehp, "Speed" to view.key.speed, "Capacitor" to view.key.capacitor, "Lock range" to view.key.lock, "Align time" to view.key.align)
        CellGrid(keys.size + 1, radius = 8.dp, padding = 14.dp, vertical = 14.dp) { i ->
            if (i == 0) {
                val any = offense.totalDps > 0
                KeyCell("DPS", KeyFigure(
                    value = if (any) dpsText(offense.totalDps) else "—",
                    note = if (any) "${dpsText(offense.weaponDps)} weapons · ${dpsText(offense.droneDps)} drones" else "Nothing fitted deals damage",
                ))
            } else KeyCell(keys[i - 1].first, keys[i - 1].second)
        }
        Gap(CardGap)
    }
}

@Composable
private fun KeyCell(label: String, figure: KeyFigure) {
    Label(label)
    Gap(7.dp)
    val tone = when (figure.tone) { "good" -> Yo.good; "bad" -> Yo.bad; else -> Color.Unspecified }
    FigureUnit(figure.value, figure.unit, type.figure, color = tone, unitSize = 13f)
    if (figure.note != null) Txt(figure.note, type.meta, Modifier.padding(top = 7.dp))
}

/** The summary's flag says how many; this says what. Only drawn when there is something wrong. */
internal fun LazyListScope.problems(view: FitSheet) {
    if (view.problems.isEmpty()) return
    card("problems", alert = true) {
        Txt("Problems", type.h2)
        Gap(14.dp)
        view.problems.forEach { problem ->
            RowLine()
            Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Tag(problem.label, TagTone.Bad)
                Txt(problem.text, type.body, Modifier.weight(1f))
            }
        }
    }
}

internal fun LazyListScope.missingSkills(view: FitSheet) {
    if (view.missing.isEmpty()) return
    card("missing", alert = true) {
        SheetHead("Missing skills", note = "Trained level, then the level this fit needs")
        Gap(14.dp)
        view.missing.forEach { skill ->
            RowLine()
            Row(Modifier.fillMaxWidth().heightIn(min = 40.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LevelBlocks(skill.have, queuedTo = skill.need, showDigit = false)
                Txt(skill.name, type.body, Modifier.weight(1f))
                Txt("${skill.have} → ${skill.need}", type.mono, color = Yo.bad)
            }
        }
    }
}
