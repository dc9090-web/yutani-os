package com.yutanios.app.screens

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.AssetsData
import com.yutanios.app.model.Paths
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Info
import com.yutanios.app.ui.InfoSheet
import com.yutanios.app.ui.Res
import com.yutanios.app.ui.Screen
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.resource
import com.yutanios.app.ui.type
import com.yutanios.app.ui.whenMissing

/**
 * Everything one character owns, by station: the filter, the totals, then one row per location
 * that opens into its ships, containers and loose stacks.
 */
@Composable
fun AssetsScreen(characterId: Long, initialQuery: String = "", initiallyExpandAll: Boolean = false) {
    val state by resource(Paths.assets(characterId), AssetsData.serializer())
    val data = (state as? Res.Ready)?.data
    var query by remember(characterId) { mutableStateOf(initialQuery) }
    // Null until a location is first tapped, so "all open" can follow the data when it arrives.
    var expandedChoice by remember(characterId) { mutableStateOf<Set<Long>?>(null) }
    var collapsedHolders by remember(characterId) { mutableStateOf(emptySet<Long>()) }
    var info by remember { mutableStateOf<Info?>(null) }

    val locations = data?.locations ?: emptyList()
    val expanded = expandedChoice ?: if (initiallyExpandAll) locations.map { it.locationId }.toSet() else emptySet()
    // Grouping a big hangar is not free: once per copy of the data, and only the filter runs on typing.
    val contents = remember(data) { locations.associate { it.locationId to locationContents(it.nodes) } }
    val shown = remember(data, query) { shownLocations(locations, contents, query) }
    val rows = remember(shown, expanded, collapsedHolders) { assetRows(shown, expanded, collapsedHolders, data?.descriptions ?: emptyMap()) }

    Screen("Assets", perCharacter = true) {
        if (whenMissing(state) || data == null) return@Screen
        item(key = "filter") { AssetFilter(query, { query = it }); Gap(20.dp) }
        item(key = "totals") {
            AssetTotals(assetCount(data.itemCount), assetCount(locations.size.toLong()), locations.firstOrNull())
            Gap(20.dp)
        }
        if (locations.isEmpty()) {
            item(key = "unsynced") { Empty("Not synced yet — the assets job runs hourly.") }
            return@Screen
        }
        items(rows.size, key = { rows[it].key }, contentType = { rows[it]::class }) { i ->
            val row = rows[i]
            AssetListSlice(
                first = i == 0, last = i == rows.lastIndex,
                open = row !is AssetListRow.Loc || row.open,
                closesLocation = row is AssetListRow.BodyEnd || (row is AssetListRow.Loc && !row.open),
            ) {
                when (row) {
                    is AssetListRow.Loc -> AssetLocationRow(row.location, row.open) {
                        val id = row.location.locationId
                        expandedChoice = if (id in expanded) expanded - id else expanded + id
                    }
                    is AssetListRow.Holder -> AssetHolderHead(
                        row.holder, row.open, row.description, top = rows[i - 1] is AssetListRow.Loc,
                        onToggle = { collapsedHolders = row.holder.itemId.let { if (it in collapsedHolders) collapsedHolders - it else collapsedHolders + it } },
                        onInfo = { info = it },
                    )
                    is AssetListRow.Group -> AssetGroupHead(row.name, row.count, if (rows[i - 1] is AssetListRow.Loc) 6 else row.gapAbove)
                    is AssetListRow.Item -> AssetItemLine(row.row, row.description) { info = it }
                    is AssetListRow.Rule -> AssetRule()
                    is AssetListRow.BodyEnd -> Gap(20.dp)
                }
            }
        }
        if (shown.isEmpty()) item(key = "none") { Txt("No locations or items match that filter.", type.body, color = Yo.textMuted) }
        item(key = "foot") { Txt(assetsFoot(query, shown.size, locations.size), type.meta, Modifier.padding(top = 12.dp)) }
    }
    InfoSheet(info) { info = null }
}
