package com.yutanios.app.screens

import com.yutanios.app.model.AssetLocation
import com.yutanios.app.model.AssetNode
import kotlin.math.floor

/**
 * The grouping and filtering the site does in the browser (`locationContents`, `filterContents` in
 * `src/lib/view/assets.ts`, and the list in `src/app/assets/AssetsBrowser.tsx`), ported function for
 * function: the API sends the bare tree, so the phone has to arrange it the same way. The tests are
 * the site's cases.
 */

data class AssetItemRow(
    val key: String, val typeId: Long, val typeName: String,
    /** The pilot's own name for the item; null for most rows. */
    val name: String?,
    val iconUrl: String,
    /** Stack quantities summed, or the number of identical modules merged. */
    val quantity: Long,
    /** "Scan Resolution Script loaded in each". */
    val note: String?,
    /** "High 1–6" for fitted modules; null elsewhere. */
    val where: String?,
    val isBlueprintCopy: Boolean,
)

data class AssetGroupView(val name: String, val count: String, val items: List<AssetItemRow>)

data class AssetHolderView(
    val itemId: Long, val typeId: Long, val iconUrl: String, val title: String,
    /** The pilot's own name for the ship or container. */
    val label: String?,
    val summary: String,
    /** Where the holder itself sits, in capitals ("HANGAR"). */
    val flag: String,
    val groups: List<AssetGroupView>,
)

data class AssetContents(val holders: List<AssetHolderView>, val loose: List<AssetGroupView>)

/** `grouped` in the site's format.ts: 1234567 -> "1,234,567". */
private fun grouped(value: Long): String {
    val digits = (if (value < 0) -value else value).toString()
    val out = StringBuilder()
    digits.forEachIndexed { i, c -> if (i > 0 && (digits.length - i) % 3 == 0) out.append(','); out.append(c) }
    return (if (value < 0) "-" else "") + out
}

/** A count as the site prints it: "1,668". */
fun assetCount(value: Long): String = grouped(value)

/** "1,323 items" / "1 item". */
fun assetItems(count: Long): String = plural(count, "item")

/** "27,294 m³" / "1.2 m³": whole numbers grouped, small volumes to one decimal. */
fun assetVolume(m3: Double): String {
    if (m3 >= 10) return "${grouped(floor(m3 + 0.5).toLong())} m³"
    val tenths = floor(m3 * 10 + 0.5).toLong()
    return (if (tenths % 10 == 0L) "${tenths / 10}" else "${tenths / 10}.${tenths % 10}") + " m³"
}

private fun plural(n: Long, one: String, many: String = "${one}s") = "${grouped(n)} ${if (n == 1L) one else many}"

private class Slot(val family: Int, val name: String, val slot: Int)

private val SLOT_FAMILIES = listOf(
    Regex("HiSlot(\\d+)") to "High", Regex("MedSlot(\\d+)") to "Mid", Regex("LoSlot(\\d+)") to "Low",
    Regex("RigSlot(\\d+)") to "Rig", Regex("SubSystemSlot(\\d+)") to "Subsystem",
)

/** `HiSlot3` -> family 0 ("High"), slot 4; null for anything that is not a fitting slot. */
private fun slotOf(rawFlag: String): Slot? {
    SLOT_FAMILIES.forEachIndexed { family, (pattern, name) ->
        pattern.matchEntire(rawFlag)?.let { return Slot(family, name, it.groupValues[1].toInt() + 1) }
    }
    return null
}

/** [1,2,3,5] -> "1–3, 5". */
private fun slotRange(slots: List<Int>): String {
    val sorted = slots.sorted()
    val parts = mutableListOf<String>()
    var i = 0
    while (i < sorted.size) {
        var j = i
        while (j + 1 < sorted.size && sorted[j + 1] == sorted[j] + 1) j++
        parts += if (i == j) "${sorted[i]}" else "${sorted[i]}–${sorted[j]}"
        i = j + 1
    }
    return parts.joinToString(", ")
}

private fun plainRow(node: AssetNode, key: String) =
    AssetItemRow(key, node.typeId, node.typeName, node.name, node.iconUrl, node.quantity, null, null, node.isBlueprintCopy)

/** Identical stacks (same type, same custom name, same original/copy) become one row. */
private fun mergeStacks(nodes: List<AssetNode>, prefix: String): List<AssetItemRow> {
    val rows = LinkedHashMap<String, AssetItemRow>()
    for (node in nodes) {
        val key = "$prefix:${node.typeId}:${node.name ?: ""}:${if (node.isBlueprintCopy) "c" else "o"}"
        val row = rows[key]
        rows[key] = if (row == null) plainRow(node, key) else row.copy(quantity = row.quantity + node.quantity)
    }
    return rows.values.toList()
}

/**
 * The Fitted column. ESI gives a loaded charge the same slot flag as its module, so each slot is a
 * module plus, perhaps, a charge; the charge becomes a note on the module's row. Modules of one type
 * carrying the same charge, in the same slot family, merge into one row with their slot range.
 */
private fun fittedGroup(nodes: List<AssetNode>): AssetGroupView? {
    class Entry(val slot: Slot) { val modules = mutableListOf<AssetNode>(); val charges = mutableListOf<AssetNode>() }
    class Fitted(val family: Int, val familyName: String, val module: AssetNode, val charge: AssetNode?) { val slots = mutableListOf<Int>() }
    val bySlot = LinkedHashMap<String, Entry>()
    for (node in nodes) {
        val slot = slotOf(node.rawFlag) ?: continue
        val entry = bySlot.getOrPut(node.rawFlag) { Entry(slot) }
        (if (node.isCharge) entry.charges else entry.modules) += node
    }
    if (bySlot.isEmpty()) return null
    val merged = LinkedHashMap<String, Fitted>()
    for (entry in bySlot.values) {
        // A slot holding only a charge (the module's row missing from ESI) still shows what is there.
        val occupants = entry.modules.ifEmpty { entry.charges }
        val charge = if (entry.modules.isNotEmpty()) entry.charges.firstOrNull() else null
        for (module in occupants) {
            val key = "${entry.slot.family}:${module.typeId}:${charge?.typeId ?: 0}"
            merged.getOrPut(key) { Fitted(entry.slot.family, entry.slot.name, module, charge) }.slots += entry.slot.slot
        }
    }
    val rows = merged.values.sortedWith(compareBy<Fitted> { it.family }.thenBy { it.slots.min() })
    return AssetGroupView(
        name = "Fitted",
        count = plural(rows.sumOf { it.slots.size }.toLong(), "item"),
        items = rows.map { row ->
            plainRow(row.module, "fit:${row.family}:${row.module.typeId}:${row.charge?.typeId ?: 0}").copy(
                quantity = row.slots.size.toLong(),
                note = row.charge?.let { "${it.typeName} loaded${if (row.slots.size > 1) " in each" else ""}" },
                where = "${row.familyName} ${slotRange(row.slots)}",
            )
        },
    )
}

private val GROUP_ORDER = listOf("Fitted", "Drone bay", "Cargo hold")
private fun groupRank(name: String) = GROUP_ORDER.indexOf(name).let { if (it == -1) GROUP_ORDER.size else it }

/** Everything directly inside one ship or container, as columns; deeper containers get a column each. */
private fun holderGroups(children: List<AssetNode>, prefix: String): List<AssetGroupView> {
    val groups = mutableListOf<AssetGroupView>()
    fittedGroup(children)?.let { groups += it }

    val byFlag = LinkedHashMap<String, MutableList<AssetNode>>()
    for (node in children) if (slotOf(node.rawFlag) == null) byFlag.getOrPut(node.flag) { mutableListOf() } += node
    for ((flag, nodes) in byFlag) {
        val items = mergeStacks(nodes, "$prefix:$flag")
        val count = if (flag == "Drone bay") plural(nodes.sumOf { it.quantity }, "drone") else plural(items.size.toLong(), "stack")
        groups += AssetGroupView(flag, count, items)
    }
    groups.sortWith(compareBy<AssetGroupView> { groupRank(it.name) }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.name })

    // A container (or a ship in a maintenance bay) inside this one: its contents follow as their own column.
    for (node in children) {
        if (node.children.isEmpty()) continue
        val label = if (node.name == null) node.typeName else "${node.typeName} “${node.name}”"
        for (group in holderGroups(node.children, "$prefix:${node.itemId}")) groups += group.copy(name = "$label · ${group.name}")
    }
    return groups
}

private fun countNodes(nodes: List<AssetNode>): Long = nodes.sumOf { 1 + countNodes(it.children) }

private fun holderSummary(node: AssetNode): String {
    val fitted = node.children.count { slotOf(it.rawFlag) != null && !it.isCharge }
    val drones = node.children.filter { it.rawFlag == "DroneBay" }.sumOf { it.quantity }
    val cargo = node.children.count { it.rawFlag == "Cargo" }
    val parts = listOfNotNull(
        if (fitted > 0) "$fitted fitted" else null,
        if (drones > 0) plural(drones, "drone") else null,
        if (cargo > 0) plural(cargo.toLong(), "cargo stack") else null,
    )
    return "${plural(countNodes(node.children), "item")} inside${if (parts.isEmpty()) "" else ": ${parts.joinToString(", ")}"}"
}

/**
 * One location's contents: every item that holds something (a fitted ship, a filled container) as
 * a holder with its columns, and everything else (loose stacks, empty hulls) as columns by where
 * in the station it sits (Hangar, Deliveries, …).
 */
fun locationContents(nodes: List<AssetNode>): AssetContents {
    val holders = mutableListOf<AssetHolderView>()
    val looseByFlag = LinkedHashMap<String, MutableList<AssetNode>>()
    for (node in nodes) {
        if (node.children.isNotEmpty()) {
            holders += AssetHolderView(
                node.itemId, node.typeId, node.iconUrl.replace(Regex("size=32$"), "size=64"), node.typeName, node.name,
                holderSummary(node), node.flag.uppercase(), holderGroups(node.children, node.itemId.toString()),
            )
        } else {
            looseByFlag.getOrPut(node.flag) { mutableListOf() } += node
        }
    }
    val loose = looseByFlag.map { (flag, list) ->
        val items = mergeStacks(list, "loose:$flag")
        AssetGroupView(flag, plural(items.size.toLong(), "stack"), items)
    }
    return AssetContents(holders, loose)
}

private fun rowMatches(row: AssetItemRow, needle: String) =
    needle in row.typeName.lowercase() || needle in (row.name ?: "").lowercase() || needle in (row.note ?: "").lowercase()

private fun filterGroups(groups: List<AssetGroupView>, needle: String) =
    groups.map { it.copy(items = it.items.filter { row -> rowMatches(row, needle) }) }.filter { it.items.isNotEmpty() }

/**
 * Narrows a location's contents to the rows matching `query` (type name, custom name, or the charge
 * note). A holder whose own name matches stays whole, so "Hurricane" still shows the ship's fit.
 * A blank query returns the input unchanged.
 */
fun filterContents(contents: AssetContents, query: String): AssetContents {
    val needle = query.trim().lowercase()
    if (needle.isEmpty()) return contents
    val holders = contents.holders.mapNotNull { holder ->
        if (needle in holder.title.lowercase() || needle in (holder.label ?: "").lowercase()) return@mapNotNull holder
        filterGroups(holder.groups, needle).takeIf { it.isNotEmpty() }?.let { holder.copy(groups = it) }
    }
    return AssetContents(holders, filterGroups(contents.loose, needle))
}

fun contentsEmpty(contents: AssetContents) = contents.holders.isEmpty() && contents.loose.isEmpty()

/** One location as the list shows it. `itemHit`: an item matched the filter, so the location is held open. */
data class ShownLocation(val location: AssetLocation, val contents: AssetContents, val itemHit: Boolean)

/**
 * The locations the filter leaves. A match on the location's name keeps it whole and closed; a
 * match on something inside it keeps only the matches and opens it.
 */
fun shownLocations(locations: List<AssetLocation>, contents: Map<Long, AssetContents>, query: String): List<ShownLocation> {
    val needle = query.trim().lowercase()
    return locations.mapNotNull { location ->
        val all = contents.getValue(location.locationId)
        if (needle.isEmpty() || needle in location.label.lowercase()) return@mapNotNull ShownLocation(location, all, false)
        val narrowed = filterContents(all, needle)
        if (contentsEmpty(narrowed)) null else ShownLocation(location, narrowed, true)
    }
}

/** The line under the list. */
fun assetsFoot(query: String, shown: Int, total: Int): String {
    val noun = "location${if (total == 1) "" else "s"}"
    return if (query.isBlank()) "All $total $noun, most items first" else "$shown of $total $noun match"
}

/**
 * One row of the lazy list. A real character has thousands of items, so the open locations are
 * flattened into these and only the rows on screen are ever composed.
 */
sealed interface AssetListRow {
    val key: String

    data class Loc(val location: AssetLocation, val open: Boolean) : AssetListRow { override val key get() = "loc:${location.locationId}" }
    data class Holder(val locationId: Long, val holder: AssetHolderView, val description: String?, val open: Boolean) : AssetListRow {
        override val key get() = "holder:$locationId:${holder.itemId}"
    }
    /** `gapAbove` in dp: the site's gap between a holder's header and its first column, then between columns. */
    data class Group(override val key: String, val name: String, val count: String, val gapAbove: Int) : AssetListRow
    data class Item(override val key: String, val row: AssetItemRow, val description: String?) : AssetListRow
    /** The ruled gap between one holder and the next, or the loose items after them. */
    data class Rule(override val key: String) : AssetListRow
    /** The padding that closes an open location. */
    data class BodyEnd(override val key: String) : AssetListRow
}

/**
 * The visible rows: each location, and under the open ones their holders, columns and items.
 * A location with a matching item is open whatever `expanded` says, and its holders too.
 */
fun assetRows(shown: List<ShownLocation>, expanded: Set<Long>, collapsedHolders: Set<Long>, descriptions: Map<String, String>): List<AssetListRow> {
    val out = ArrayList<AssetListRow>()
    fun groups(groups: List<AssetGroupView>, prefix: String, firstGap: Int) = groups.forEachIndexed { g, group ->
        out += AssetListRow.Group("group:$prefix:$g", group.name, group.count, if (g == 0) firstGap else 18)
        group.items.forEach { out += AssetListRow.Item("item:$prefix:$g:${it.key}", it, descriptions[it.typeId.toString()]) }
    }
    for ((location, contents, itemHit) in shown) {
        val id = location.locationId
        val open = itemHit || id in expanded
        out += AssetListRow.Loc(location, open)
        if (!open) continue
        var ruled = false
        for (holder in contents.holders) {
            if (ruled) out += AssetListRow.Rule("rule:$id:${holder.itemId}")
            val holderOpen = itemHit || holder.itemId !in collapsedHolders
            out += AssetListRow.Holder(id, holder, descriptions[holder.typeId.toString()], holderOpen)
            if (holderOpen) groups(holder.groups, "$id:${holder.itemId}", 14)
            ruled = true
        }
        if (contents.loose.isNotEmpty()) {
            if (ruled) out += AssetListRow.Rule("rule:$id:loose")
            groups(contents.loose, "$id:loose", 0)
        }
        out += AssetListRow.BodyEnd("end:$id")
    }
    return out
}
