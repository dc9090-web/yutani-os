package com.yutanios.app

import com.yutanios.app.model.AssetLocation
import com.yutanios.app.model.AssetNode
import com.yutanios.app.model.SystemRef
import com.yutanios.app.screens.AssetListRow
import com.yutanios.app.screens.assetItems
import com.yutanios.app.screens.assetRows
import com.yutanios.app.screens.assetVolume
import com.yutanios.app.screens.assetsFoot
import com.yutanios.app.screens.contentsEmpty
import com.yutanios.app.screens.filterContents
import com.yutanios.app.screens.locationContents
import com.yutanios.app.screens.shownLocations
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

private val FLAGS = mapOf(
    "Hangar" to "Hangar", "Cargo" to "Cargo hold", "DroneBay" to "Drone bay", "SpecializedOreHold" to "Ore hold",
    "LoSlot0" to "Low slot 1", "LoSlot1" to "Low slot 2", "HiSlot0" to "High slot 1",
)

private fun n(
    itemId: Long, typeId: Long, typeName: String, rawFlag: String, name: String? = null, quantity: Long = 1,
    isCharge: Boolean = false, isBlueprintCopy: Boolean = false, children: List<AssetNode> = emptyList(),
) = AssetNode(
    itemId, typeId, typeName, name, quantity, FLAGS[rawFlag] ?: rawFlag, rawFlag, isBlueprintCopy, isCharge, 0.0,
    "https://images.evetech.net/types/$typeId/icon?size=32", children,
)

/** The cases of `locationContents` and `filterContents` in the site's tests/view/assets.test.ts. */
class AssetsContentsTest {
    private val hurricane = n(1, 100, "Hurricane Fleet Issue", "Hangar", name = "Wraith", children = buildList {
        for (i in 0..5) add(n(10L + i, 200, "220mm Vulcan AutoCannon II", "HiSlot$i"))
        add(n(16, 201, "Heavy Assault Missile Launcher II", "HiSlot6"))
        add(n(17, 201, "Heavy Assault Missile Launcher II", "HiSlot7"))
        add(n(20, 300, "Sensor Booster II", "MedSlot0")); add(n(21, 301, "Scan Resolution Script", "MedSlot0", isCharge = true))
        add(n(22, 300, "Sensor Booster II", "MedSlot2")); add(n(23, 301, "Scan Resolution Script", "MedSlot2", isCharge = true))
        add(n(24, 300, "Sensor Booster II", "MedSlot3"))
        add(n(30, 400, "Medium Trimark Armor Pump II", "RigSlot0"))
        add(n(40, 500, "Hobgoblin II", "DroneBay", quantity = 5)); add(n(41, 500, "Hobgoblin II", "DroneBay", quantity = 5))
        add(n(50, 600, "Hail M", "Cargo", quantity = 3000)); add(n(51, 600, "Hail M", "Cargo", quantity = 848))
        add(n(52, 700, "Small Secure Container", "Cargo", name = "Loot", children = listOf(n(60, 34, "Tritanium", "Unlocked", quantity = 9))))
        add(n(53, 800, "Veldspar", "SpecializedOreHold", quantity = 10))
    })

    @Test fun anItemThatHoldsThingsIsAHolderWithASummaryAndItsFlagInCapitals() {
        val (holders, loose) = locationContents(listOf(hurricane))
        assertTrue(loose.isEmpty())
        val holder = holders.single()
        assertEquals("Hurricane Fleet Issue", holder.title)
        assertEquals("Wraith", holder.label)
        assertEquals("HANGAR", holder.flag)
        assertEquals("21 items inside: 12 fitted, 10 drones, 3 cargo stacks", holder.summary)
        assertEquals("https://images.evetech.net/types/100/icon?size=64", holder.iconUrl)
    }

    @Test fun columnsAreFittedDroneBayCargoHoldThenTheRestThenNestedContainers() {
        assertEquals(
            listOf("Fitted" to "12 items", "Drone bay" to "10 drones", "Cargo hold" to "2 stacks", "Ore hold" to "1 stack", "Small Secure Container “Loot” · Unlocked" to "1 stack"),
            locationContents(listOf(hurricane)).holders[0].groups.map { it.name to it.count },
        )
    }

    @Test fun identicalModulesMergeBySlotFamilyAndChargeWithASlotRange() {
        val fitted = locationContents(listOf(hurricane)).holders[0].groups[0]
        assertEquals(
            listOf(
                listOf(6L, "220mm Vulcan AutoCannon II", null, "High 1–6"),
                listOf(2L, "Heavy Assault Missile Launcher II", null, "High 7–8"),
                listOf(2L, "Sensor Booster II", "Scan Resolution Script loaded in each", "Mid 1, 3"),
                listOf(1L, "Sensor Booster II", null, "Mid 4"),
                listOf(1L, "Medium Trimark Armor Pump II", null, "Rig 1"),
            ),
            fitted.items.map { listOf(it.quantity, it.typeName, it.note, it.where) },
        )
    }

    @Test fun identicalStacksSumIntoOneRow() {
        val groups = locationContents(listOf(hurricane)).holders[0].groups
        assertEquals(listOf(10L to "Hobgoblin II"), groups[1].items.map { it.quantity to it.typeName })
        assertEquals(listOf(Triple(3848L, "Hail M", null), Triple(1L, "Small Secure Container", "Loot")), groups[2].items.map { Triple(it.quantity, it.typeName, it.name) })
    }

    @Test fun looseItemsSitInColumnsByWhereTheyAreOriginalsApartFromCopies() {
        val (holders, loose) = locationContents(listOf(
            n(1, 34, "Tritanium", "Hangar", quantity = 100), n(2, 34, "Tritanium", "Hangar", quantity = 50),
            n(3, 691, "Rifter Blueprint", "Hangar"), n(4, 691, "Rifter Blueprint", "Hangar", isBlueprintCopy = true),
            n(5, 587, "Rifter", "Hangar"), n(6, 35, "Pyerite", "Deliveries"),
        ))
        assertTrue(holders.isEmpty())
        assertEquals(listOf("Hangar" to "4 stacks", "Deliveries" to "1 stack"), loose.map { it.name to it.count })
        assertEquals(
            listOf(Triple(150L, "Tritanium", false), Triple(1L, "Rifter Blueprint", false), Triple(1L, "Rifter Blueprint", true), Triple(1L, "Rifter", false)),
            loose[0].items.map { Triple(it.quantity, it.typeName, it.isBlueprintCopy) },
        )
    }

    @Test fun aSlotHoldingOnlyAChargeStillShows() {
        val ship = n(1, 100, "Rifter", "Hangar", children = listOf(n(2, 301, "Hail S", "HiSlot0", isCharge = true, quantity = 40)))
        assertEquals(listOf("Hail S" to "High 1"), locationContents(listOf(ship)).holders[0].groups[0].items.map { it.typeName to it.where })
    }

    private val contents = locationContents(listOf(hurricane, n(90, 34, "Tritanium", "Hangar", quantity = 5)))

    @Test fun filterKeepsOnlyMatchingRowsDroppingEmptyColumnsAndHolders() {
        val out = filterContents(contents, "hail")
        assertEquals(listOf("Cargo hold"), out.holders[0].groups.map { it.name })
        assertTrue(out.loose.isEmpty())
        assertTrue(contentsEmpty(filterContents(contents, "zzz")))
    }

    @Test fun filterMatchesTheChargeNoteAndNestedContainers() {
        assertEquals(listOf("Sensor Booster II"), filterContents(contents, "scan resolution").holders[0].groups[0].items.map { it.typeName })
        val trit = filterContents(contents, "tritanium")
        assertEquals(listOf("Small Secure Container “Loot” · Unlocked"), trit.holders[0].groups.map { it.name })
        assertEquals(1, trit.loose[0].items.size)
    }

    @Test fun filterKeepsAHolderWholeWhenItsNameOrThePilotsNameMatches() {
        assertEquals(5, filterContents(contents, "wraith").holders[0].groups.size)
        assertEquals(5, filterContents(contents, "hurricane").holders[0].groups.size)
    }

    @Test fun blankFilterReturnsTheInput() {
        assertSame(contents, filterContents(contents, "  "))
    }

    @Test fun volumesAndCountsReadAsTheSitePrintsThem() {
        assertEquals("27,294 m³", assetVolume(27294.0))
        assertEquals("39,752 m³", assetVolume(39752.26))
        assertEquals("1.2 m³", assetVolume(1.2))
        assertEquals("0 m³", assetVolume(0.0))
        assertEquals("9.9 m³", assetVolume(9.94))
        assertEquals("10 m³", assetVolume(10.4))
        assertEquals("1,323 items", assetItems(1323))
        assertEquals("1 item", assetItems(1))
    }
}

/** The cases of the site's tests/components/assets-browser.test.tsx, against the rows the list is drawn from. */
class AssetsListTest {
    private val jita = AssetLocation(
        60003760, "Jita IV - Moon 4 - Caldari Navy Assembly Plant", 1323, 27294.0, SystemRef("Jita", "0.9", "sec-high"),
        listOf(
            n(1035000000001, 587, "Rifter", "Hangar", name = "Scarlet Dart", children = listOf(
                n(2001, 519, "Gyrostabilizer II", "LoSlot0"), n(2003, 519, "Gyrostabilizer II", "LoSlot1"),
                n(2004, 484, "125mm Gatling AutoCannon II", "HiSlot0"), n(2005, 12608, "Hail S", "HiSlot0", isCharge = true, quantity = 120),
                n(2006, 2454, "Hobgoblin I", "DroneBay", quantity = 2), n(2007, 12608, "Hail S", "Cargo", quantity = 500),
            )),
            n(2002, 691, "Rifter Blueprint", "Hangar", isBlueprintCopy = true),
        ),
    )
    private val amarr = AssetLocation(60008494, "Amarr VIII - Emperor Family Academy", 1, 1.2, null, listOf(n(3001, 34, "Tritanium", "Hangar", quantity = 120)))
    private val locations = listOf(jita, amarr)
    private val contents = locations.associate { it.locationId to locationContents(it.nodes) }
    private val descriptions = mapOf("519" to "Raises projectile damage and rate of fire.")

    private fun rows(query: String = "", expanded: Set<Long> = emptySet(), collapsed: Set<Long> = emptySet()) =
        assetRows(shownLocations(locations, contents, query), expanded, collapsed, descriptions)
    private fun names(rows: List<AssetListRow>) = rows.filterIsInstance<AssetListRow.Item>().map { it.row.typeName }
    private fun open(rows: List<AssetListRow>) = rows.filterIsInstance<AssetListRow.Loc>().associate { it.location.locationId to it.open }

    @Test fun locationsStartCollapsed() {
        val rows = rows()
        assertEquals(2, rows.size)
        assertEquals(mapOf(jita.locationId to false, amarr.locationId to false), open(rows))
        assertEquals("All 2 locations, most items first", assetsFoot("", 2, 2))
        assertEquals("All 1 location, most items first", assetsFoot(" ", 1, 1))
    }

    @Test fun anOpenLocationShowsItsHoldersThenTheLooseItems() {
        val rows = rows(expanded = setOf(jita.locationId))
        val holder = rows.filterIsInstance<AssetListRow.Holder>().single()
        assertEquals("6 items inside: 3 fitted, 2 drones, 1 cargo stack", holder.holder.summary)
        assertEquals("HANGAR", holder.holder.flag)
        assertEquals(listOf("Fitted" to "3 items", "Drone bay" to "2 drones", "Cargo hold" to "1 stack", "Hangar" to "1 stack"), rows.filterIsInstance<AssetListRow.Group>().map { it.name to it.count })
        val items = rows.filterIsInstance<AssetListRow.Item>().map { it.row }
        assertEquals(listOf(1L, "125mm Gatling AutoCannon II", "Hail S loaded", "High 1"), items[0].let { listOf(it.quantity, it.typeName, it.note, it.where) })
        assertEquals(listOf(2L, "Gyrostabilizer II", null, "Low 1–2"), items[1].let { listOf(it.quantity, it.typeName, it.note, it.where) })
        assertTrue(items.last().isBlueprintCopy)
        // The open location, its ship with three columns, the rule, the loose column, the closing gap; then the closed location.
        assertEquals(
            listOf("Loc", "Holder", "Group", "Item", "Item", "Group", "Item", "Group", "Item", "Rule", "Group", "Item", "BodyEnd", "Loc"),
            rows.map { it::class.simpleName },
        )
        assertEquals(rows.size, rows.map { it.key }.toSet().size)
    }

    @Test fun descriptionsRideOnTheRowsThatHaveOne() {
        val items = rows(expanded = setOf(jita.locationId)).filterIsInstance<AssetListRow.Item>()
        assertEquals("Raises projectile damage and rate of fire.", items.first { it.row.typeName == "Gyrostabilizer II" }.description)
        assertNull(items.first { it.row.typeName == "Hobgoblin I" }.description)
    }

    @Test fun severalLocationsStayOpenAtOnceAndAHolderFoldsAway() {
        val both = rows(expanded = setOf(jita.locationId, amarr.locationId))
        assertTrue("Tritanium" in names(both) && "Hobgoblin I" in names(both))
        assertEquals(listOf("Tritanium"), names(rows(expanded = setOf(amarr.locationId))))
        assertEquals(listOf("Rifter Blueprint"), names(rows(expanded = setOf(jita.locationId), collapsed = setOf(1035000000001))))
    }

    @Test fun filteringByItemOpensMatchingLocationsAndShowsOnlyTheMatches() {
        val rows = rows("gyro")
        assertEquals(mapOf(jita.locationId to true), open(rows))
        assertEquals(listOf("Gyrostabilizer II"), names(rows))
        assertEquals("1 of 2 locations match", assetsFoot("gyro", 1, 2))
        // A folded ship cannot hide a match.
        assertEquals(listOf("Gyrostabilizer II"), names(rows("GYRO ", collapsed = setOf(1035000000001))))
    }

    @Test fun filteringByLocationNameLeavesItClosedWithAllItsContents() {
        assertEquals(mapOf(amarr.locationId to false), open(rows("amarr")))
        assertEquals(listOf("Tritanium"), names(rows("amarr", expanded = setOf(amarr.locationId))))
    }

    @Test fun aShipIsFoundByThePilotsNameAndShowsItsWholeFit() {
        val found = names(rows("scarlet"))
        assertTrue("Gyrostabilizer II" in found && "Hobgoblin I" in found)
        assertFalse("Rifter Blueprint" in found)
    }

    @Test fun aFilterThatMatchesNothingLeavesNothing() {
        assertTrue(rows("zzz").isEmpty())
        assertEquals("0 of 2 locations match", assetsFoot("zzz", 0, 2))
    }
}
