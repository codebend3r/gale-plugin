package com.codebend3r.gale.core

import org.junit.Assert.assertFalse
import org.junit.Test

/** Edges the shared cases don't reach. */
class ContractTest {
    private val settings = PathSettings("", "")

    @Test
    fun `should restart ignores the filesystem root itself`() {
        assertFalse(shouldRestart("/", "/work/app", settings))
    }

    @Test
    fun `should restart ignores a bare file name`() {
        assertFalse(shouldRestart("gale.json", "/work/app", settings))
    }
}
