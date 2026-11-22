package com.yutanios.app.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.yutanios.app.ui.LevelBlocks
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.type

/**
 * One slice of a `.yo-card` whose rows are separate lazy items: a queue or a skill group can run
 * to hundreds of rows, so the card is drawn piece by piece instead of as one item.
 */
internal fun Modifier.cardPart(first: Boolean = false, last: Boolean = false): Modifier {
    fun shape(radius: Dp) = RoundedCornerShape(
        topStart = if (first) radius else 0.dp, topEnd = if (first) radius else 0.dp,
        bottomStart = if (last) radius else 0.dp, bottomEnd = if (last) radius else 0.dp,
    )
    return fillMaxWidth().background(Yo.border, shape(8.dp))
        .padding(start = 1.dp, end = 1.dp, top = if (first) 1.dp else 0.dp, bottom = if (last) 1.dp else 0.dp)
        .background(Yo.surface, shape(7.dp)).padding(horizontal = 15.dp)
}

/** Lifts an item into the space the item above left under itself. */
internal fun Modifier.pullUp(by: Dp): Modifier = layout { measurable, constraints ->
    val placeable = measurable.measure(constraints)
    val shift = by.roundToPx()
    layout(placeable.width, (placeable.height - shift).coerceAtLeast(0)) { placeable.place(0, -shift) }
}

private enum class Block { Filled, Training, Queued, Empty }

@Composable
private fun LegendItem(block: Block, text: String) {
    val shape = RoundedCornerShape(1.dp)
    val box = Modifier.size(10.dp)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        when (block) {
            Block.Filled -> Box(box.background(Yo.blockFilled, shape))
            Block.Training -> Box(box.background(Yo.accent.copy(alpha = 0.4f), shape).border(1.dp, Yo.accent, shape))
            Block.Queued -> Box(box.border(1.dp, Yo.accent.copy(alpha = 0.65f), shape))
            Block.Empty -> Box(box.border(1.dp, Yo.blockEmpty, shape))
        }
        Txt(text, type.meta, maxLines = 1)
    }
}

/** `.yo-legend`: the key above a list of level blocks, with an optional mono note at its end. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun BlockLegend(modifier: Modifier = Modifier, untrained: Boolean = false, end: String? = null) {
    FlowRow(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(22.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        LegendItem(Block.Filled, "Trained")
        LegendItem(Block.Training, "Training now")
        LegendItem(Block.Queued, "Queued")
        if (untrained) LegendItem(Block.Empty, "Untrained")
        if (end != null) Txt(end, type.mono, Modifier.weight(1f), Yo.textMuted, maxLines = 1, align = TextAlign.End)
    }
}

/** A queue entry's blocks: every level below the target solid, the target amber. The site's `queueBlocks`. */
@Composable
internal fun QueueBlocks(target: Int, training: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        LevelBlocks(filled = target - 1, queuedTo = target, training = if (training) target else 0, showDigit = false)
        // `.sk-level.is-target`: the digit is the level being trained, so it is not dimmed.
        Txt(target.toString(), type.mono, Modifier.padding(start = 6.dp))
    }
}

/** `.yo-flag`: a small mono capital note in a row. */
@Composable
internal fun Flag(text: String, color: Color = Yo.accent) = Txt(text, type.tag, color = color, maxLines = 1)

/** `.yo-info-btn`: the "i" in a circle after a name; amber on a tinted tile while its panel is open. */
@Composable
internal fun InfoGlyph(open: Boolean) {
    val color = if (open) Yo.accent else Yo.textLabel
    Box(Modifier.size(28.dp).clip(RoundedCornerShape(4.dp)).background(if (open) Yo.surfaceControl else Color.Transparent), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(16.dp)) {
            val middle = Offset(size.width / 2, size.height / 2)
            val line = 1.4.dp.toPx()
            drawCircle(color, size.minDimension / 2 - line / 2, middle, style = Stroke(line))
            drawCircle(color, line * 0.6f, Offset(middle.x, middle.y - 3.2.dp.toPx()))
            drawLine(color, Offset(middle.x, middle.y - 0.8.dp.toPx()), Offset(middle.x, middle.y + 3.6.dp.toPx()), line, StrokeCap.Round)
        }
    }
}

/** `.yo-info-panel`: the description, opened inline under its row. */
@Composable
internal fun InfoPanel(text: String, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(6.dp)
    Txt(
        text, type.body,
        modifier.padding(top = 2.dp, bottom = 10.dp).fillMaxWidth().background(Yo.surfaceSunken, shape).border(1.dp, Yo.border, shape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        Yo.text2,
    )
}

/** `.yo-bar-pct`: the whole-number percentage after a bar. */
@Composable
internal fun Percent(value: Int, modifier: Modifier = Modifier) =
    Txt("$value%", type.mono, modifier.width(40.dp), Yo.textMuted, maxLines = 1, align = TextAlign.End)
