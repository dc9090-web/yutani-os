package com.yutanios.app

import io.ktor.client.engine.HttpClientEngine
import okio.FileSystem

expect fun platformHttpEngine(): HttpClientEngine
expect val platformFileSystem: FileSystem
