package com.yutanios.app.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage

/** Text in a theme style. Every piece of text in the app goes through here. */
@Composable
fun Txt(
    text: String, style: TextStyle, modifier: Modifier = Modifier, color: Color = Color.Unspecified,
    maxLines: Int = Int.MAX_VALUE, align: TextAlign? = null,
) {
    val merged = style.merge(TextStyle(color = color, textAlign = align ?: TextAlign.Unspecified))
    BasicText(text, modifier, merged, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
}

/** The uppercase micro label above every value. */
@Composable fun Label(text: String, modifier: Modifier = Modifier, color: Color = Yo.textLabel) =
    Txt(text.uppercase(), type.label, modifier, color, maxLines = 1)

@Composable fun PageTitle(text: String, modifier: Modifier = Modifier) = Txt(text, type.h1, modifier)

/** `.yo-card`: surface, hairline border, 8dp radius, 16dp padding on a phone. */
@Composable
fun Card(modifier: Modifier = Modifier, padding: Dp = 16.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Yo.surface)
            .border(1.dp, Yo.border, RoundedCornerShape(8.dp)).padding(padding),
        content = content,
    )
}

/** A card title with an optional mono figure at the right. */
@Composable
fun CardHead(title: String, figure: String? = null, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Txt(title, type.h2, Modifier.weight(1f))
        if (figure != null) Txt(figure, type.mono, color = Yo.textMuted)
    }
}

data class Stat(val label: String, val figure: String, val unit: String? = null, val note: String? = null, val tone: Color = Yo.text)

/** `.yo-stat-strip`: cells divided by hairlines, two across on a phone. */
@Composable
fun StatStrip(stats: List<Stat>, modifier: Modifier = Modifier, columns: Int = 2) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Yo.border).border(1.dp, Yo.border, RoundedCornerShape(8.dp)),
        verticalArrangement = Arrangement.spacedBy(1.dp),
    ) {
        stats.chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                row.forEach { stat ->
                    Column(Modifier.weight(1f).background(Yo.surfaceSunken).padding(horizontal = 14.dp, vertical = 12.dp).heightIn(min = 44.dp)) {
                        Label(stat.label)
                        Spacer(Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.Bottom) {
                            Txt(stat.figure, type.figure, color = stat.tone, maxLines = 1)
                            if (stat.unit != null) Txt(" ${stat.unit}", type.tag, Modifier.padding(bottom = 3.dp))
                        }
                        if (stat.note != null) Txt(stat.note, type.meta, Modifier.padding(top = 2.dp), maxLines = 1)
                    }
                }
                // Keep the grid square when the last row is short.
                repeat(columns - row.size) { Box(Modifier.weight(1f).background(Yo.surfaceSunken)) }
            }
        }
    }
}

/** `.yo-bar`: 4dp tall, 6dp segments with 2dp gaps. `fraction` may exceed 1; the fill stops at the end. */
@Composable
fun SegBar(fraction: Float, modifier: Modifier = Modifier, color: Color = Yo.blockFilled) {
    Canvas(modifier.fillMaxWidth().height(4.dp)) {
        val seg = 6.dp.toPx()
        val step = 8.dp.toPx()
        val fill = size.width * fraction.coerceIn(0f, 1f)
        var x = 0f
        while (x < size.width) {
            val w = minOf(seg, size.width - x)
            drawRect(Yo.track, Offset(x, 0f), Size(w, size.height))
            if (x < fill) drawRect(color, Offset(x, 0f), Size(minOf(w, fill - x), size.height))
            x += step
        }
    }
}

/**
 * `.yo-blocks`: five squares for a skill level. `queued` levels get an amber outline, the level
 * `training` now pulses. Followed by the level as a digit, and sits left of the name it describes.
 */
@Composable
fun LevelBlocks(filled: Int, modifier: Modifier = Modifier, total: Int = 5, queuedTo: Int = 0, training: Int = 0, showDigit: Boolean = true) {
    val pulse by rememberInfiniteTransition().animateFloat(1f, 0.25f, infiniteRepeatable(tween(800), RepeatMode.Reverse))
    Row(modifier.semantics { contentDescription = "Level $filled of $total" }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for (level in 1..total) {
            val shape = RoundedCornerShape(1.dp)
            val box = Modifier.size(10.dp)
            when {
                level <= filled -> Box(box.background(Yo.blockFilled, shape))
                level == training -> Box(box.alpha(pulse).background(Yo.accent.copy(alpha = 0.4f), shape).border(1.dp, Yo.accent, shape))
                level <= queuedTo -> Box(box.border(1.dp, Yo.accent.copy(alpha = 0.65f), shape))
                else -> Box(box.border(1.dp, Yo.blockEmpty, shape))
            }
        }
        if (showDigit) Txt(filled.toString(), type.mono, Modifier.padding(start = 3.dp), Yo.textMuted)
    }
}

enum class TagTone { Main, Outline, Accent, Good, Bad }

/** `.yo-tag`: MAIN is amber-filled; the rest are outlined mono capitals. */
@Composable
fun Tag(text: String, tone: TagTone = TagTone.Outline, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(3.dp)
    val (fg, line) = when (tone) {
        TagTone.Main -> Yo.bg to Yo.accent
        TagTone.Outline -> Yo.textMuted to Yo.borderControl
        TagTone.Accent -> Yo.accent to Yo.accent.copy(alpha = 0.6f)
        TagTone.Good -> Yo.good to Yo.good.copy(alpha = 0.6f)
        TagTone.Bad -> Yo.bad to Yo.bad.copy(alpha = 0.6f)
    }
    val base = if (tone == TagTone.Main) modifier.background(Yo.accent, shape) else modifier.border(1.dp, line, shape)
    Txt(text.uppercase(), type.tag, base.padding(horizontal = 5.dp, vertical = 2.dp), fg, maxLines = 1)
}

/** `.yo-tabs`: the segmented control. Each tab is 44dp tall. */
@Composable
fun Tabs(labels: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(8.dp)
    Row(modifier.fillMaxWidth().clip(shape).background(Yo.surfaceSunken).border(1.dp, Yo.border, shape).padding(3.dp)) {
        labels.forEachIndexed { i, label ->
            val on = i == selected
            Box(
                Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(6.dp)).background(if (on) Yo.surfaceControl else Color.Transparent)
                    .clickable(role = Role.Tab) { onSelect(i) },
                contentAlignment = Alignment.Center,
            ) { Txt(label, type.nav, color = if (on) Yo.text else Yo.textMuted, maxLines = 1) }
        }
    }
}

/** A security status in its colour: teal high, amber low, coral null — always beside the number itself. */
fun secColor(secClass: String?): Color = when (secClass) {
    "sec-high" -> Yo.good
    "sec-low" -> Yo.accent
    else -> Yo.bad
}

/** `Place` on the site: a location name with its system's security status in colour. */
@Composable
fun Place(name: String, sec: String?, secClass: String?, modifier: Modifier = Modifier, style: TextStyle = type.meta) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        if (sec != null) Txt(sec, type.mono, Modifier.padding(end = 6.dp), secColor(secClass))
        Txt(name, style, maxLines = 2)
    }
}

/** `.yo-tile`: a square holding a real EVE image (portrait, ship render, item icon). */
@Composable
fun Tile(url: String?, size: Dp, modifier: Modifier = Modifier, description: String? = null, radius: Dp = 4.dp) {
    val shape = RoundedCornerShape(radius)
    Box(modifier.size(size).clip(shape).background(Yo.surfaceControl).border(1.dp, Yo.borderTile, shape)) {
        if (url != null) AsyncImage(model = url, contentDescription = description, modifier = Modifier.size(size), contentScale = ContentScale.Crop)
    }
}

/** CCP's public image server; the phone reaches it directly and Coil keeps what it has seen. */
object EveImage {
    fun portrait(characterId: Long, size: Int = 128) = "https://images.evetech.net/characters/$characterId/portrait?size=$size"
    fun icon(typeId: Long, size: Int = 64) = "https://images.evetech.net/types/$typeId/icon?size=$size"
    fun render(typeId: Long, size: Int = 256) = "https://images.evetech.net/types/$typeId/render?size=$size"
}

@Composable
fun Chevron(open: Boolean, modifier: Modifier = Modifier, color: Color = Yo.textMuted) {
    Canvas(modifier.size(14.dp).rotate(if (open) 90f else 0f)) {
        val s = Stroke(1.6.dp.toPx(), cap = StrokeCap.Round)
        drawLine(color, Offset(size.width * 0.38f, size.height * 0.22f), Offset(size.width * 0.66f, size.height * 0.5f), s.width, StrokeCap.Round)
        drawLine(color, Offset(size.width * 0.66f, size.height * 0.5f), Offset(size.width * 0.38f, size.height * 0.78f), s.width, StrokeCap.Round)
    }
}

/** `.yo-disclosure-row`: a full-width row that opens its body beneath it. Several can be open at once. */
@Composable
fun Disclosure(open: Boolean, onToggle: () -> Unit, modifier: Modifier = Modifier, header: @Composable RowScope.() -> Unit, body: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().background(if (open) Yo.surfaceOpen else Color.Transparent)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(role = Role.Button, onClick = onToggle).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Chevron(open)
            header()
        }
        if (open) Column(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 12.dp), content = body)
    }
}

/** A hairline between rows. */
@Composable fun RowLine(modifier: Modifier = Modifier, color: Color = Yo.borderRow) = Box(modifier.fillMaxWidth().height(1.dp).background(color))

/** `.yo-empty`: one quiet line where a list has nothing in it. */
@Composable fun Empty(text: String, modifier: Modifier = Modifier) =
    Txt(text, type.meta, modifier.fillMaxWidth().padding(vertical = 20.dp), align = TextAlign.Center)

/** `.yo-btn`: an outlined 44dp control. */
@Composable
fun Btn(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, primary: Boolean = false, enabled: Boolean = true) {
    val shape = RoundedCornerShape(6.dp)
    val base = if (primary) modifier.background(if (enabled) Yo.accent else Yo.surfaceControl, shape) else modifier.border(1.dp, Yo.borderControl, shape)
    Box(base.clip(shape).heightIn(min = 44.dp).clickable(enabled = enabled, role = Role.Button, onClick = onClick).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
        Txt(text, type.bodyStrong, color = if (!enabled) Yo.textDisabled else if (primary) Yo.bg else Yo.text, maxLines = 1)
    }
}

/**
 * The site shows an item's description on hover. A phone has no hover, so a long press opens the
 * same text in a sheet. Wrap any row with [describable] and show [InfoSheet] while one is chosen.
 */
data class Info(val title: String, val text: String)

fun Modifier.describable(info: Info?, onShow: (Info) -> Unit, onClick: (() -> Unit)? = null): Modifier =
    if (info == null && onClick == null) this
    else combinedClickable(onClick = { onClick?.invoke() }, onLongClick = info?.let { { onShow(it) } })

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InfoSheet(info: Info?, onDismiss: () -> Unit) {
    if (info == null) return
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Yo.surface) {
        Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 32.dp)) {
            Txt(info.title, type.h2)
            Spacer(Modifier.height(10.dp))
            Txt(info.text, type.body, color = Yo.text2)
        }
    }
}

@Composable fun Gap(height: Dp) = Spacer(Modifier.height(height))
@Composable fun GapW(width: Dp) = Spacer(Modifier.width(width))
