package com.yutanios.app

import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.okhttp.OkHttp
import okio.FileSystem

actual fun platformHttpEngine(): HttpClientEngine = OkHttp.create()
actual val platformFileSystem: FileSystem get() = FileSystem.SYSTEM
