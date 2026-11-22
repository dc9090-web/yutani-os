package com.yutanios.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.yutanios.app.ui.Yo

/**
 * One slice of a `.yo-card` whose rows are separate lazy items: the card's surface and side borders,
 * with the top edge and corners on the first slice and the bottom ones on the last.
 */
internal fun Modifier.cardSegment(first: Boolean, last: Boolean): Modifier {
    fun shape(radius: Int) = RoundedCornerShape(
        topStart = if (first) radius.dp else 0.dp, topEnd = if (first) radius.dp else 0.dp,
        bottomStart = if (last) radius.dp else 0.dp, bottomEnd = if (last) radius.dp else 0.dp,
    )
    return fillMaxWidth().background(Yo.border, shape(8))
        .padding(start = 1.dp, end = 1.dp, top = if (first) 1.dp else 0.dp, bottom = if (last) 1.dp else 0.dp)
        .clip(shape(7)).background(Yo.surface)
}
