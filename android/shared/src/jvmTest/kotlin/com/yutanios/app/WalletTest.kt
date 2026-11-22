package com.yutanios.app

import com.yutanios.app.model.JournalRow
import com.yutanios.app.model.Older
import com.yutanios.app.model.Paths
import com.yutanios.app.model.TransactionRow
import com.yutanios.app.model.WALLET_OLDER_PAGE
import com.yutanios.app.model.WALLET_STORED
import com.yutanios.app.model.WalletEntry
import com.yutanios.app.model.WalletRows
import com.yutanios.app.model.WalletSummary
import com.yutanios.app.model.footNote
import com.yutanios.app.model.hasOlder
import com.yutanios.app.model.nextOffset
import com.yutanios.app.model.plusPage
import com.yutanios.app.model.walletBalance
import com.yutanios.app.model.walletEntries
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WalletContractTest {
    private fun balance(id: Long) = Fixtures.decode(Paths.walletBalance(id), WalletSummary.serializer())
    private fun journal(id: Long) = Fixtures.decode(Paths.wallet(id, "journal"), WalletRows.serializer(JournalRow.serializer()))
    private fun trades(id: Long) = Fixtures.decode(Paths.wallet(id, "transactions"), WalletRows.serializer(TransactionRow.serializer()))

    @Test fun storedPathsAreTheSyncedOnes() {
        for (path in listOf(Paths.walletBalance(9000001), Paths.wallet(9000001, "journal"), Paths.wallet(9000001, "transactions"))) {
            assertTrue(path in Fixtures.paths, path)
        }
    }

    @Test fun balances() {
        assertEquals("1,284,503,217.44", balance(9000001).balance)
        assertEquals(1284503217.44, balance(9000001).balanceIsk)
        assertNull(balance(9000002).balance)
        assertNull(balance(9000003).balanceIsk)
    }

    @Test fun journal() {
        val page = journal(9000001)
        assertEquals("journal", page.kind)
        assertEquals(0, page.offset)
        assertEquals(500, page.limit)
        assertEquals(8, page.rows.size)
        val tax = page.rows[0]
        assertEquals(5002L, tax.id)
        assertEquals("10:42", tax.time)
        assertEquals("2026-03-14", tax.day)
        assertEquals("Transaction tax", tax.refType)
        assertEquals("−662,400.00", tax.signedAmount)
        assertEquals("neg", tax.sign)
        assertEquals("1,266,103,217.44", tax.balanceText)
        assertEquals("Own escrow", page.rows[3].withParty)
        assertEquals("pos", page.rows[1].sign)
        // A row with no amount: nothing to colour, dashes on screen.
        val bare = page.rows[7]
        assertNull(bare.signedAmount)
        assertNull(bare.balanceText)
        assertEquals("", bare.sign)
        assertTrue(journal(9000002).rows.isEmpty())
        assertTrue(journal(9000003).rows.isEmpty())
    }

    @Test fun transactions() {
        val page = trades(9000001)
        assertEquals("transactions", page.kind)
        assertEquals(4, page.rows.size)
        val sell = page.rows[0]
        assertEquals(6001L, sell.transactionId)
        assertEquals("Sell", sell.side)
        assertEquals("Hobgoblin II", sell.typeName)
        assertEquals(2456L, sell.typeId)
        assertEquals("20", sell.quantity)
        assertEquals("920,000.00", sell.unitText)
        assertEquals("+18,400,000.00", sell.signedTotal)
        assertEquals("Jita", sell.system?.name)
        assertEquals("Buy", page.rows[1].side)
        assertEquals("−2,052,500.00", page.rows[1].signedTotal)
        assertEquals("Perimeter - Example Trade Tower", page.rows[2].location)
        assertTrue(trades(9000002).rows.isEmpty())
        assertTrue(trades(9000003).rows.isEmpty())
    }

    @Test fun fixtureJournalGroupsByDay() {
        val entries = walletEntries(journal(9000001).rows) { it.day }
        val days = entries.filterIsInstance<WalletEntry.Day>()
        assertEquals(listOf("2026-03-14" to 2, "2026-03-13" to 2, "2026-03-12" to 1, "2026-03-11" to 1, "2026-03-10" to 2), days.map { it.day to it.count })
        assertEquals(13, entries.size)
        assertTrue(entries[0] is WalletEntry.Day)
        assertEquals(5002L, (entries[1] as WalletEntry.Line).row.id)
    }
}

class WalletPagingTest {
    private data class Row(val id: Long, val day: String = "d")
    private fun rows(range: IntRange) = range.map { Row(it.toLong()) }

    @Test fun onlyAFullStoredListHasOlderRows() {
        assertFalse(hasOlder(0, Older<Row>()))
        assertFalse(hasOlder(WALLET_STORED - 1, Older<Row>()))
        assertTrue(hasOlder(WALLET_STORED, Older<Row>()))
        assertFalse(hasOlder(WALLET_STORED, Older<Row>(done = true)))
    }

    @Test fun aFullPageAppendsAndLeavesMoreToAsk() {
        val stored = rows(1..500)
        val first = Older<Row>().plusPage(stored, rows(501..600)) { it.id }
        assertEquals(100, first.rows.size)
        assertFalse(first.done)
        assertTrue(hasOlder(stored.size, first))
        assertEquals(600, nextOffset(stored.size, first))
        val second = first.plusPage(stored, rows(601..700)) { it.id }
        assertEquals((501L..700L).toList(), second.rows.map { it.id })
        assertEquals(700, nextOffset(stored.size, second))
    }

    @Test fun aShortPageEndsTheList() {
        val stored = rows(1..500)
        val older = Older<Row>().plusPage(stored, rows(501..540)) { it.id }
        assertTrue(older.done)
        assertEquals(40, older.rows.size)
        assertFalse(hasOlder(stored.size, older))
        val empty = Older<Row>().plusPage(stored, emptyList()) { it.id }
        assertTrue(empty.done)
        assertTrue(empty.rows.isEmpty())
    }

    @Test fun rowsAlreadyShownAreNotRepeatedButStillCountTowardsTheOffset() {
        val stored = rows(1..500)
        // Three new rows reached the site since the sync, so its row 500 onwards starts three back.
        val first = Older<Row>().plusPage(stored, rows(498..597)) { it.id }
        assertEquals((501L..597L).toList(), first.rows.map { it.id })
        assertEquals(100, first.fetched)
        assertEquals(600, nextOffset(stored.size, first))
        assertFalse(first.done)
        val second = first.plusPage(stored, rows(597..640)) { it.id }
        assertEquals((501L..640L).toList(), second.rows.map { it.id })
        assertTrue(second.done)
    }

    @Test fun firstOlderRequestStartsAfterTheStoredRows() {
        assertEquals(WALLET_STORED, nextOffset(WALLET_STORED, Older<Row>()))
        assertEquals(
            "/api/v1/characters/7/wallet?kind=journal&offset=500&limit=100",
            Paths.wallet(7, "journal", offset = nextOffset(WALLET_STORED, Older<Row>()), limit = WALLET_OLDER_PAGE),
        )
    }

    @Test fun consecutiveRowsOfADayShareAHeader() {
        val list = listOf(Row(1, "b"), Row(2, "b"), Row(3, "a"), Row(4, "b"))
        val entries = walletEntries(list) { it.day }
        assertEquals(
            listOf(WalletEntry.Day("b", 2), WalletEntry.Line(list[0]), WalletEntry.Line(list[1]), WalletEntry.Day("a", 1), WalletEntry.Line(list[2]), WalletEntry.Day("b", 1), WalletEntry.Line(list[3])),
            entries,
        )
        assertTrue(walletEntries(emptyList<Row>()) { it.day }.isEmpty())
    }

    @Test fun footNoteReadsAsTheSites() {
        assertEquals("All 8 journal entries", footNote(8, false, "journal entry", "journal entries"))
        assertEquals("All 1 market transaction", footNote(1, false, "market transaction", "market transactions"))
        assertEquals("Showing the latest 500 journal entries", footNote(500, true, "journal entry", "journal entries"))
    }
}
