package com.yutanios.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yutanios.app.model.AssetLocation
import com.yutanios.app.ui.Chevron
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Info
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.Place
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Tag
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.describable
import com.yutanios.app.ui.type

// Sizes the Assets CSS uses that the type scale lacks.
/** `.yo-input`: 14px UI face. */
private val inputText @Composable get() = type.body.copy(fontSize = 14.sp)
/** `.as-holder-title`: 16px display face. */
private val holderTitle @Composable get() = type.h2.copy(fontSize = 16.sp)
/** `.as-qty`, `.as-group-count`: 12px mono. */
private val smallMono @Composable get() = type.mono.copy(fontSize = 12.sp, color = Yo.textMuted)
/** `.as-where`: 11.5px mono. */
private val whereMono @Composable get() = type.mono.copy(fontSize = 11.5.sp, color = Yo.textMuted)
/** `.yo-stat-figure.is-name`: a name where a figure would be, 14px medium. */
private val statName @Composable get() = type.bodyStrong.copy(fontSize = 14.sp)

/** `.as-filter`: the micro label over a `.yo-input` search box, full width on a phone. */
@Composable
fun AssetFilter(query: String, onQuery: (String) -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(6.dp)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Label("Filter by name")
        BasicTextField(
            value = query, onValueChange = onQuery, singleLine = true, textStyle = inputText, cursorBrush = SolidColor(Yo.text),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.fillMaxWidth().height(44.dp).clip(shape).background(Yo.surfaceSunken).border(1.dp, Yo.borderControl, shape),
            decorationBox = { field ->
                Box(Modifier.padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) Txt("Gyrostabilizer, Tritanium…", inputText, color = Yo.textLabel, maxLines = 1)
                    field()
                }
            },
        )
    }
}

/**
 * The totals strip. The shared strip cannot do this one: its third cell spans both columns and
 * holds a place name with its security status, not a figure.
 */
@Composable
fun AssetTotals(items: String, locations: String, largest: AssetLocation?, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(8.dp)
    Column(modifier.fillMaxWidth().clip(shape).background(Yo.border).border(1.dp, Yo.border, shape), verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
            listOf("Items" to items, "Locations" to locations).forEach { (label, figure) ->
                Column(Modifier.weight(1f).background(Yo.surfaceSunken).padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Label(label)
                    Txt(figure, type.figure, maxLines = 1)
                }
            }
        }
        Column(Modifier.fillMaxWidth().background(Yo.surfaceSunken).padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Label("Largest location")
            if (largest == null) Txt("—", type.figure) else {
                Place(largest.label, largest.system?.sec, largest.system?.secClass, style = statName)
                Txt(assetItems(largest.itemCount), type.mono, color = Yo.textMuted)
            }
        }
    }
}

/**
 * One slice of `.as-list`. The list is a single bordered card on the site; here every row is its
 * own lazy item, so each draws its share of that card: the side borders, the rounded ends, and the
 * hairline that closes a location.
 */
@Composable
fun AssetListSlice(first: Boolean, last: Boolean, open: Boolean, closesLocation: Boolean, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(if (first) 8.dp else 0.dp, if (first) 8.dp else 0.dp, if (last) 8.dp else 0.dp, if (last) 8.dp else 0.dp)
    Box(
        Modifier.fillMaxWidth().clip(shape).background(Yo.border)
            .padding(start = 1.dp, end = 1.dp, top = if (first) 1.dp else 0.dp, bottom = if (closesLocation) 1.dp else 0.dp)
            .background(if (open) Yo.surfaceOpen else Yo.surface),
    ) { content() }
}

/** `.as-loc-row` at phone width, two lines: the name, then "41 items" and the volume. */
@Composable
fun AssetLocationRow(location: AssetLocation, open: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).clickable(role = Role.Button, onClick = onToggle).padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Chevron(open, Modifier.padding(top = 3.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Place(location.label, location.system?.sec, location.system?.secClass, style = if (open) type.body.copy(fontWeight = FontWeight.SemiBold) else type.body)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Txt(assetItems(location.itemCount), type.mono, maxLines = 1)
                Txt(assetVolume(location.volume), type.mono, color = Yo.textMuted, maxLines = 1)
            }
        }
    }
}

/** The padding every row inside an open location shares (`.as-body`: 16px either side). */
private val bodySides = Modifier.fillMaxWidth().padding(horizontal = 16.dp)

/**
 * `.as-holder-head`: a ship or container with what it holds summed up, and where it sits. Tapping
 * folds its contents away; a long press explains the hull.
 */
@Composable
fun AssetHolderHead(holder: AssetHolderView, open: Boolean, description: String?, top: Boolean, onToggle: () -> Unit, onInfo: (Info) -> Unit) {
    Row(
        Modifier.fillMaxWidth().describable(description?.let { Info(holder.title, it) }, onInfo, onToggle)
            .padding(start = 16.dp, end = 16.dp, top = if (top) 6.dp else 0.dp, bottom = if (open) 0.dp else 2.dp).heightIn(min = 44.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Tile(holder.iconUrl, 40.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            RichTxt(
                buildAnnotatedString {
                    append(holder.title)
                    if (holder.label != null) withStyle(SpanStyle(fontFamily = type.body.fontFamily, fontWeight = FontWeight.Normal, fontSize = 13.5.sp, color = Yo.text2)) { append(" ${holder.label}") }
                },
                holderTitle, maxLines = 2,
            )
            Txt(holder.summary, type.meta)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Tag(holder.flag)
            Chevron(open)
        }
    }
}

/** `.as-group-head`: the column's name in capitals with its count, ruled underneath. */
@Composable
fun AssetGroupHead(name: String, count: String, gapAbove: Int) {
    Column(bodySides.padding(top = gapAbove.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Txt(name.uppercase(), type.h3.copy(color = Yo.text), Modifier.weight(1f, fill = false), maxLines = 2)
            Txt(count, smallMono, maxLines = 1)
        }
        RowLine(color = Yo.borderControl)
    }
}

/** `.as-item`: icon, quantity, the name with the pilot's own name and any charge note, and the slot range. */
@Composable
fun AssetItemLine(row: AssetItemRow, description: String?, onInfo: (Info) -> Unit) {
    Column(Modifier.fillMaxWidth().describable(description?.let { Info(row.typeName, it) }, onInfo).padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 43.dp).padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            // The API's own image address: blueprints only have bp/bpc pictures, which it already picked.
            Tile(row.iconUrl.replace("size=32", "size=64"), 30.dp)
            Txt(if (row.quantity > 1) "${assetCount(row.quantity)}×" else "", smallMono, Modifier.widthIn(min = 34.dp), align = TextAlign.End, maxLines = 1)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    RichTxt(
                        buildAnnotatedString {
                            append(row.typeName)
                            if (row.name != null) withStyle(SpanStyle(color = Yo.textMuted)) { append(" ${row.name}") }
                        },
                        type.body, Modifier.weight(1f, fill = false), maxLines = 2,
                    )
                    if (row.isBlueprintCopy) Tag("BPC")
                }
                if (row.note != null) Txt(row.note, type.meta.copy(fontSize = 12.sp))
            }
            if (row.where != null) Txt(row.where, whereMono, maxLines = 1)
        }
        RowLine(color = Yo.border)
    }
}

/** The ruled gap between holders (`.as-holder + .as-holder`). */
@Composable
fun AssetRule() {
    Column(bodySides) { Gap(16.dp); RowLine(color = Yo.borderControl); Gap(16.dp) }
}

/** `Txt` for text with more than one style in it. */
@Composable
private fun RichTxt(text: AnnotatedString, style: TextStyle, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE) =
    BasicText(text, modifier, style, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
