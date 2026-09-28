package com.codebend3r.gale.ide

import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer

class GaleConfigurableTest : GaleTestCase() {
    private val restarted = mutableListOf<Project>()

    private fun configurable(): GaleConfigurable =
        GaleConfigurable(project) { restarted += it }.also {
            it.createComponent()
            Disposer.register(testRootDisposable) { it.disposeUIResources() }
        }

    fun testStartsUnmodified() {
        assertFalse(configurable().isModified)
    }

    fun testNoticesStoredSettingsThatDifferFromTheFormAndResetReloadsThem() {
        val configurable = configurable()

        settings.state.configPath = "config/gale.json"
        settings.state.enabled = false
        assertTrue(configurable.isModified)

        configurable.reset()
        assertFalse(configurable.isModified)
    }

    fun testApplyWritesTheFormToTheSettingsAndRestartsGale() {
        settings.state.binaryPath = "/opt/gale/bin/gale"
        val configurable = configurable()
        settings.state.binaryPath = "/somewhere/else"

        configurable.apply()

        assertEquals("/opt/gale/bin/gale", settings.state.binaryPath)
        assertEquals(listOf(project), restarted)
    }

    fun testShowsUnsetPathsAsEmpty() {
        settings.state.configPath = null
        settings.state.binaryPath = null

        assertFalse(configurable().isModified)
    }

    fun testThePlatformCreatedConfigurableRestartsGaleOnApply() {
        val configurable = GaleConfigurable(project)
        configurable.createComponent()
        try {
            configurable.apply()
        } finally {
            configurable.disposeUIResources()
        }
    }
}
