package com.yutanios.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yutanios.app.model.Gauge
import com.yutanios.app.model.StatRow
import com.yutanios.app.time.roman
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.LevelBlocks
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.SegBar
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.YoType
import com.yutanios.app.ui.type

/** `.sp-stat dd`, `.sd-headline`, `.sd-repair-value`: mono at 14px, a size the type scale has no token for. */
internal val YoType.mono14: TextStyle get() = mono.copy(fontSize = 14.sp)

/** `.sd-layer-hp`, `.sd-drone-meta`: 11.5px muted mono, for the small print beside a name where 12.5 would not fit. */
internal val YoType.monoSmall: TextStyle get() = mono.copy(fontSize = 11.5.sp, lineHeight = 15.sp, color = Yo.textMuted)

/** `.sp-value`: a ship's value on its card, 17px medium mono. */
internal val YoType.value17: TextStyle get() = figure.copy(fontSize = 17.sp)

/** `.sd-value`: the value in the sheet's summary, 24px medium mono. */
internal val YoType.value24: TextStyle get() = figure.copy(fontSize = 24.sp)

/** Text of more than one style on one line of flow: a figure with its unit, a location with its security status. */
@Composable
internal fun Rich(text: AnnotatedString, style: TextStyle, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE, align: TextAlign? = null) =
    BasicText(text, modifier, style.merge(TextStyle(textAlign = align ?: TextAlign.Unspecified)), maxLines = maxLines, overflow = TextOverflow.Ellipsis)

/** "27.2M ISK", "988 m/s": the figure in `style`, its unit smaller and muted after it. */
@Composable
internal fun FigureUnit(value: String, unit: String?, style: TextStyle, modifier: Modifier = Modifier, color: Color = Color.Unspecified, unitSize: Float = 11f) {
    val text = buildAnnotatedString {
        withStyle(style.toSpanStyle().copy(color = if (color == Color.Unspecified) style.color else color)) { append(value) }
        if (unit != null) withStyle(style.toSpanStyle().copy(fontSize = unitSize.sp, fontWeight = FontWeight.Normal, color = Yo.textMuted)) { append(" $unit") }
    }
    Rich(text, style, modifier, maxLines = 1)
}

internal enum class Seg { Whole, Top, Mid, Bottom }

/**
 * A card drawn in pieces, so the rows between its head and its foot can each be a lazy item:
 * `Top` has the upper corners and border, `Mid` only the sides, `Bottom` closes it.
 */
@Composable
internal fun CardSeg(seg: Seg, modifier: Modifier = Modifier, alert: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val top = seg == Seg.Top || seg == Seg.Whole
    val bottom = seg == Seg.Bottom || seg == Seg.Whole
    fun shape(radius: Dp) = RoundedCornerShape(
        topStart = if (top) radius else 0.dp, topEnd = if (top) radius else 0.dp,
        bottomStart = if (bottom) radius else 0.dp, bottomEnd = if (bottom) radius else 0.dp,
    )
    Column(
        modifier.fillMaxWidth().clip(shape(8.dp)).background(if (alert) Yo.bad.copy(alpha = 0.5f) else Yo.border)
            .padding(start = 1.dp, end = 1.dp, top = if (top) 1.dp else 0.dp, bottom = if (bottom) 1.dp else 0.dp)
            .clip(shape(7.dp)).background(Yo.surface)
            .padding(start = 15.dp, end = 15.dp, top = if (top) 15.dp else 0.dp, bottom = if (bottom) 17.dp else 0.dp),
        content = content,
    )
}

/** The space between two cards of the sheet (`.sd-main` gap at phone width). */
internal val CardGap = 20.dp

/** A whole card as one item, with the gap that follows it. */
internal fun LazyListScope.card(key: String, alert: Boolean = false, content: @Composable ColumnScope.() -> Unit) =
    item(key = key) { CardSeg(Seg.Whole, alert = alert, content = content); Gap(CardGap) }

/** The piece that closes a card whose rows were lazy items. */
internal fun LazyListScope.cardEnd(key: String) = item(key = key) { CardSeg(Seg.Bottom) {}; Gap(CardGap) }

/** `.sd-card-head`: the card's title, with a mono headline at the right or a muted note beneath. */
@Composable
internal fun SheetHead(title: String, headline: String? = null, tone: Color = Color.Unspecified, unit: String? = null, note: String? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Txt(title, type.h2, Modifier.weight(1f))
        if (headline != null) FigureUnit(headline, unit, type.mono14, Modifier.padding(start = 12.dp), tone)
    }
    if (note != null) Txt(note, type.meta, Modifier.padding(top = 4.dp))
}

/** `.sd-group-title` with its count: a rack, a hold or a skill group inside a card. */
@Composable
internal fun GroupHead(title: String, count: String?, modifier: Modifier = Modifier, over: Boolean = false) {
    Row(modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Txt(title.uppercase(), type.h3.copy(color = Yo.text), maxLines = 1)
        if (count != null) Txt(count, type.mono, color = if (over) Yo.bad else Yo.textMuted, maxLines = 1)
    }
}

/**
 * Cells divided by hairlines (`.sp-stats`, `.sd-keys`, `.sd-repairs`), two across at phone width.
 * Every cell of a row is as tall as the tallest.
 */
@Composable
internal fun CellGrid(count: Int, modifier: Modifier = Modifier, radius: Dp = 6.dp, padding: Dp = 12.dp, vertical: Dp = 10.dp, cell: @Composable ColumnScope.(Int) -> Unit) {
    val shape = RoundedCornerShape(radius)
    Column(modifier.fillMaxWidth().clip(shape).background(Yo.border).border(1.dp, Yo.border, shape).padding(1.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
        (0 until count).chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                row.forEach { i ->
                    Column(Modifier.weight(1f).fillMaxHeight().background(Yo.surfaceSunken).padding(horizontal = padding, vertical = vertical), content = { cell(i) })
                }
                if (row.size == 1) Box(Modifier.weight(1f).fillMaxHeight().background(Yo.surfaceSunken))
            }
        }
    }
}

/** A fitting resource: its label, "used / output" in mono, and the segmented bar, coral when over. */
@Composable
internal fun GaugeBar(gauge: Gauge, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Label(gauge.label, Modifier.weight(1f))
            Txt(gauge.text + if (gauge.over) " · over" else "", type.mono, color = if (gauge.over) Yo.bad else Yo.textMuted, maxLines = 1)
        }
        Gap(6.dp)
        SegBar((gauge.percent / 100).toFloat(), color = if (gauge.over) Yo.bad else Yo.blockFilled)
    }
}

/** The pilot's mastery of the hull: five blocks and a Roman numeral, or a dash when the site has none. */
@Composable
internal fun Mastery(level: Int?, modifier: Modifier = Modifier, suffix: String = "") {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Txt("Mastery", type.meta)
        if (level == null) Txt("—", type.mono)
        else {
            LevelBlocks(level, showDigit = false)
            Txt((if (level == 0) "0" else roman(level)) + suffix, type.mono)
        }
    }
}

/** A status line with its dot: teal when all is well, coral when not. */
@Composable
internal fun Flag(text: String, good: Boolean, modifier: Modifier = Modifier) {
    val color = if (good) Yo.good else Yo.bad
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        Box(Modifier.size(6.dp).background(color, CircleShape))
        Txt(text, type.meta, color = color, maxLines = 1)
    }
}

/** `.yo-banner`: the coral-outlined notice that the numbers below are worst case. */
@Composable
internal fun Banner(text: String, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(8.dp)
    Txt(text, type.meta, modifier.fillMaxWidth().background(Yo.surface, shape).border(1.dp, Yo.bad, shape).padding(horizontal = 16.dp, vertical = 12.dp), Yo.bad)
}

/** `.sd-rows`: label at the left, mono value at the right, a hairline under each. "Total" is bold. */
@Composable
internal fun StatRows(rows: List<StatRow>) {
    RowLine(color = Yo.border)
    rows.forEach { row ->
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Txt(row.label, type.meta)
            Txt(row.value, if (row.label == "Total") type.mono.copy(fontWeight = FontWeight.Medium) else type.mono, Modifier.weight(1f), align = TextAlign.End)
        }
        RowLine()
    }
}

/** A side-column card of plain rows: Capacitor, Targeting, Navigation, Estimated value. */
@Composable
internal fun ColumnScope.StatCard(title: String, headline: String, rows: List<StatRow>, tone: Color = Color.Unspecified, note: String? = null) {
    SheetHead(title, headline, tone)
    Gap(14.dp)
    StatRows(rows)
    if (note != null) Txt(note, type.meta, Modifier.padding(top = 14.dp))
}

/** The site's `Place`: a station's name already begins with its system, so the system is only added when it does not. */
internal fun placeName(name: String, system: String?): String =
    if (system == null || name == system || name.startsWith("$system ")) name else "$system · $name"

internal fun plural(count: Int, one: String, many: String = one + "s"): String = "$count ${if (count == 1) one else many}"
