package com.yutanios.app

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/** The background refresh. Whatever happens it reports success: an unreachable site is not worth a retry storm. */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        (applicationContext as YutaniApp).container.syncNow()
        return Result.success()
    }
}
